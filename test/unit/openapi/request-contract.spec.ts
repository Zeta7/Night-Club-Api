/// <reference types="jest" />
import { enhanceOpenApiDocument } from '../../../src/shared/presentation/openapi/openapi.enhancer';
import { ListNotificationsQueryDto } from '../../../src/modules/notification/presentation/notification.dto';
import {
  ListWithdrawalsDto,
  DailyReconciliationQueryDto,
} from '../../../src/modules/wallets/presentation/withdrawal.dto';
import { ListPromotionsQueryDto } from '../../../src/modules/promotions/presentation/dto/create-promotion.dto';
import {
  CreatePresignedUploadUrlDto,
  ALLOWED_IMAGE_CONTENT_TYPES,
} from '../../../src/modules/uploads/presentation/dto/create-presigned-upload-url.dto';

import 'reflect-metadata';
import { INestApplication, Module, Type, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../src/shared/infrastructure/prisma/prisma.service';
import { UploadsService } from '../../../src/modules/uploads/application/uploads.service';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { ReferralExpirationMode, UserRole, UserStatus } from '@prisma/client';
import { CreateEventDto } from '../../../src/modules/events/presentation/dto/create-event.dto';
import { UpdateEventDto } from '../../../src/modules/events/presentation/dto/update-event.dto';
import { UpdateTicketTypeDto } from '../../../src/modules/tickets/presentation/dto/update-ticket-type.dto';
import { UpdateMyProfileDto } from '../../../src/modules/users/presentation/dto/update-my-profile.dto';
import { UpdateNotificationPreferenceDto } from '../../../src/modules/notification/presentation/notification.dto';
import { UpdateClubDto } from '../../../src/modules/clubs/presentation/dto/update-club.dto';
import { UpdateClubWorkerDto } from '../../../src/modules/clubs/presentation/dto/update-club-worker.dto';
import { ClubWorkersService } from '../../../src/modules/clubs/application/club-workers.service';
import { UpdateReferralSettingsDto } from '../../../src/modules/referrals/presentation/referral.dto';
import { ReferralsService } from '../../../src/modules/referrals/application/referrals.service';
import { PromotionItemDto } from '../../../src/modules/promotions/presentation/dto/promotion-item.dto';
import { ValidateCodeDto } from '../../../src/modules/commerce/presentation/validate-code.dto';
import { UpdatePromotionDto } from '../../../src/modules/promotions/presentation/dto/update-promotion.dto';
import { UsersService } from '../../../src/modules/users/application/users.service';
import { createValidationException } from '../../../src/shared/presentation/validation-exception.factory';

@Module({})
class ContractModule {}

describe('Request contract: integers and PATCH presence', () => {
  let app: INestApplication;
  const modules: TestingModule[] = [];
  afterEach(async () => {
    await Promise.all(modules.splice(0).map((module) => module.close()));
  });
  let document: OpenAPIObject;
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: createValidationException,
  });
  const input = (type: Type<unknown>, body: object) =>
    pipe.transform(body, { type: 'body', metatype: type });

  beforeAll(async () => {
    app = await NestFactory.create(ContractModule, { logger: false });
    document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        CreateEventDto,
        CreatePresignedUploadUrlDto,
        ListWithdrawalsDto,
        ListPromotionsQueryDto,
        UpdateEventDto,
        UpdateTicketTypeDto,
        UpdateMyProfileDto,
        UpdatePromotionDto,
      ],
    });
  });
  afterAll(async () => app.close());

  it('publishes integer capacity, including the inherited PATCH property', () => {
    for (const name of ['CreateEventDto', 'UpdateEventDto']) {
      expect(document.components?.schemas?.[name]).toMatchObject({
        properties: { capacity: { type: 'integer', minimum: 1 } },
      });
    }
  });

  it('publishes nullable fields independently from optional fields', () => {
    expect(document.components?.schemas?.UpdateEventDto).toMatchObject({
      properties: { description: { type: 'string', nullable: true } },
    });
    expect(document.components?.schemas?.UpdateTicketTypeDto).toMatchObject({
      properties: { perUserLimit: { type: 'integer', nullable: true } },
    });
  });

  it.each(['name', 'capacity', 'startsAt', 'removeImage'])(
    'rejects null for event %s with 400',
    async (field) => {
      await expect(input(UpdateEventDto, { [field]: null })).rejects.toMatchObject({
        status: 400,
        response: {
          error: { code: 'VALIDATION_ERROR', details: [expect.objectContaining({ field })] },
        },
      });
    },
  );

  it('preserves the distinction between an omitted description and explicit null', async () => {
    const omitted = await input(UpdateEventDto, {});
    const cleared = await input(UpdateEventDto, { description: null });
    expect(omitted.description).toBeUndefined();
    expect(cleared.description).toBeNull();
  });

  it('inherits a single optional array of promotion items without changing its schema', async () => {
    expect(document.components?.schemas?.UpdatePromotionDto).toMatchObject({
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/PromotionItemDto' } },
      },
    });
    await expect(input(UpdatePromotionDto, {})).resolves.toBeDefined();
    await expect(input(UpdatePromotionDto, { items: null })).rejects.toMatchObject({ status: 400 });
    await expect(input(UpdatePromotionDto, { items: [] })).rejects.toMatchObject({ status: 400 });
  });

  it('rejects fractional counts at the HTTP validation boundary', async () => {
    await expect(input(UpdateEventDto, { capacity: 1.5 })).rejects.toMatchObject({ status: 400 });
    await expect(
      input(PromotionItemDto, {
        itemType: 'PRODUCT',
        productId: '35b3a1a2-c03e-4e5d-bdf3-727d6ad7ab33',
        quantity: 1.5,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('validates removeImage even when an upload is also supplied', async () => {
    await expect(
      input(UpdateEventDto, { imageUploadId: 'upload', removeImage: null }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([null, 'invalid', 0])(
    'rejects invalid confirmation instead of silently coercing %s to false',
    async (confirm) => {
      await expect(input(ValidateCodeDto, { code: 'qr', confirm })).rejects.toMatchObject({
        status: 400,
      });
    },
  );

  it('rejects null inside a nested non-nullable request property', async () => {
    await expect(
      input(UpdateClubDto, { socialMedia: [{ type: null, url: 'https://example.test' }] }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects optional non-nullable booleans without treating null as omission', async () => {
    await expect(
      input(UpdateNotificationPreferenceDto, { category: 'PAYMENT', pushEnabled: null }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('clears nullable profile email while an omitted email is preserved', async () => {
    const user = {
      id: 'customer',
      email: 'current@example.test',
      fullName: 'Customer',
      profileImageUrl: null,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    };
    const update = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      ...user,
      ...data,
    }));
    const tx = { user: { update } };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      $transaction: (fn: (value: typeof tx) => unknown) => fn(tx),
    };
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: new ConfigService() },
        { provide: UploadsService, useValue: {} },
      ],
    }).compile();
    modules.push(module);
    const service = module.get(UsersService);
    await service.updateMyProfile(
      { id: user.id, role: user.role },
      plainToInstance(UpdateMyProfileDto, {}),
    );
    expect(update.mock.calls[0][0].data).not.toHaveProperty('email');
    const cleared = await input(UpdateMyProfileDto, { email: null });
    await service.updateMyProfile({ id: user.id, role: user.role }, cleared);
    expect(update.mock.calls[1][0].data).toEqual({ email: null });
  });

  it('clears worker assignments while omission preserves the saved assignments', async () => {
    const worker = {
      id: 'worker',
      user: { profileImageUrl: null },
      roleLabel: 'Door',
      assignedDoor: 'A',
      assignedZone: 'Main',
      assignedPoint: 'Bar',
    };
    const update = jest.fn().mockResolvedValue(worker);
    const tx = { clubWorker: { update }, auditLogEntry: { create: jest.fn() } };
    const prisma = {
      club: { findUnique: jest.fn().mockResolvedValue({ id: 'club' }) },
      clubWorker: { findFirst: jest.fn().mockResolvedValue(worker) },
      $transaction: (fn: (value: typeof tx) => unknown) => fn(tx),
    };
    const module = await Test.createTestingModule({
      providers: [
        ClubWorkersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: new ConfigService() },
      ],
    }).compile();
    modules.push(module);
    const service = module.get(ClubWorkersService);
    const actor = { id: 'admin', role: UserRole.SUPER_ADMIN };
    await service.updateWorker(actor, 'club', 'worker', await input(UpdateClubWorkerDto, {}));
    expect(update.mock.calls[0][0].data).toEqual({});
    await service.updateWorker(
      actor,
      'club',
      'worker',
      await input(UpdateClubWorkerDto, {
        roleLabel: null,
        assignedDoor: null,
        assignedZone: null,
        assignedPoint: null,
      }),
    );
    expect(update.mock.calls[1][0].data).toEqual({
      roleLabel: null,
      assignedDoor: null,
      assignedZone: null,
      assignedPoint: null,
    });
  });

  it('preserves omitted campaign dates and clears explicit null without producing the Unix epoch', async () => {
    const current = {
      id: 'referral-program',
      platformCommissionBps: 1000,
      rewardBps: 100,
      minimumPlatformMarginBps: 100,
      expirationMode: ReferralExpirationMode.NONE,
      expirationDays: 30,
      startsAt: new Date('2026-01-01'),
      endsAt: new Date('2026-12-31'),
      version: 1,
    };
    const update = jest.fn().mockResolvedValue(current);
    const module = await Test.createTestingModule({
      providers: [
        ReferralsService,
        {
          provide: PrismaService,
          useValue: {
            referralProgramSettings: { upsert: jest.fn().mockResolvedValue(current), update },
          },
        },
      ],
    }).compile();
    modules.push(module);
    const service = module.get(ReferralsService);
    const actor = { id: 'admin', role: UserRole.SUPER_ADMIN };
    await service.updateSettings(actor, await input(UpdateReferralSettingsDto, {}));
    expect(update.mock.calls[0][0].data).toMatchObject({
      startsAt: current.startsAt,
      endsAt: current.endsAt,
    });
    await service.updateSettings(
      actor,
      await input(UpdateReferralSettingsDto, {
        startsAt: null,
        endsAt: null,
        maximumRewardPerOrderCents: null,
      }),
    );
    expect(update.mock.calls[1][0].data).toMatchObject({
      startsAt: null,
      endsAt: null,
      maximumRewardPerOrderCents: null,
    });
    await expect(
      input(UpdateReferralSettingsDto, { startsAt: 'not-a-date' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.updateSettings(
        actor,
        await input(UpdateReferralSettingsDto, {
          expirationMode: ReferralExpirationMode.FIXED_DAYS,
          expirationDays: null,
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    ['false', false],
    ['true', true],
  ])(
    'parses the notification query %s without truthiness coercion',
    async (unreadOnly, expected) => {
      expect(await input(ListNotificationsQueryDto, { unreadOnly })).toMatchObject({
        unreadOnly: expected,
      });
    },
  );

  it.each(['yes', '0', '', null])(
    'rejects invalid notification booleans: %s',
    async (unreadOnly) => {
      await expect(input(ListNotificationsQueryDto, { unreadOnly })).rejects.toMatchObject({
        status: 400,
      });
    },
  );

  it.each([ListWithdrawalsDto, ListPromotionsQueryDto])(
    'validates optional status values for %p',
    async (dto) => {
      await expect(input(dto, {})).resolves.toBeDefined();
      await expect(input(dto, { status: 'NOT_A_STATUS' })).rejects.toMatchObject({ status: 400 });
      await expect(input(dto, { status: null })).rejects.toMatchObject({ status: 400 });
      expect(document.components?.schemas?.[dto.name]).toMatchObject({
        properties: { status: { type: 'string', enum: expect.any(Array) } },
      });
    },
  );

  it.each(['invalid', '2026-02-30', '2026-13-01', '2026-01-01T12:00:00Z', null])(
    'rejects invalid reconciliation dates: %s',
    async (date) => {
      await expect(input(DailyReconciliationQueryDto, { date })).rejects.toMatchObject({
        status: 400,
      });
    },
  );

  it('accepts a calendar date and an omitted reconciliation date', async () => {
    await expect(input(DailyReconciliationQueryDto, { date: '2026-02-28' })).resolves.toMatchObject(
      { date: '2026-02-28' },
    );
    await expect(input(DailyReconciliationQueryDto, {})).resolves.toBeDefined();
  });

  it('documents and validates upload MIME types from the DTO without an enhancer override', async () => {
    expect(document.components?.schemas?.CreatePresignedUploadUrlDto).toMatchObject({
      properties: { contentType: { enum: [...ALLOWED_IMAGE_CONTENT_TYPES] } },
    });
    for (const contentType of ALLOWED_IMAGE_CONTENT_TYPES) {
      await expect(
        input(CreatePresignedUploadUrlDto, { fileName: 'cover', sizeBytes: 128, contentType }),
      ).resolves.toBeDefined();
    }
    await expect(
      input(CreatePresignedUploadUrlDto, {
        fileName: 'cover',
        sizeBytes: 128,
        contentType: 'application/pdf',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('preserves declared Swagger types and success schemas without guessing from names', () => {
    const contract: OpenAPIObject = {
      openapi: '3.0.0',
      info: { title: 'Contract', version: '1' },
      paths: {
        '/contract': {
          post: {
            operationId: 'ContractController_create',
            parameters: [
              { in: 'query', name: 'kind', schema: { type: 'string', enum: ['A', 'B'] } },
            ],
            requestBody: {
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ContractInput' } },
              },
            },
            responses: {
              '201': {
                description: 'Created',
                content: { 'application/json': { schema: { type: 'string', enum: ['created'] } } },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          ContractInput: {
            type: 'object',
            properties: {
              externalId: { type: 'integer' },
              emailLabel: { type: 'string' },
              callbackUrl: { type: 'string' },
            },
          },
        },
      },
    };
    const enhanced = enhanceOpenApiDocument(contract);
    expect(enhanced.components?.schemas?.ContractInput).toMatchObject({
      properties: { externalId: { type: 'integer' } },
    });
    expect(enhanced.components?.schemas?.ContractInput).not.toMatchObject({
      properties: { emailLabel: { format: 'email' } },
    });
    expect(enhanced.components?.schemas?.ContractInput).not.toMatchObject({
      properties: { callbackUrl: { format: 'uri' } },
    });
    expect(enhanced.paths['/contract'].post?.parameters?.[0]).toMatchObject({
      schema: { enum: ['A', 'B'] },
    });
    expect(enhanced.paths['/contract'].post?.responses['201']).toMatchObject({
      content: { 'application/json': { schema: { type: 'string', enum: ['created'] } } },
    });
  });

  it('rejects parameters without a schema instead of inventing a string type', () => {
    expect(() =>
      enhanceOpenApiDocument({
        openapi: '3.0.0',
        info: { title: 'Contract', version: '1' },
        paths: {
          '/contract': {
            get: {
              operationId: 'ContractController_get',
              parameters: [{ in: 'query', name: 'value' }],
              responses: {
                '200': {
                  description: 'OK',
                  content: { 'application/json': { schema: { type: 'string' } } },
                },
              },
            },
          },
        },
      }),
    ).toThrow('Missing OpenAPI schema for ContractController_get parameter value.');
  });

  it('uses the generated response when the Nest plugin supplies an empty Object placeholder', () => {
    const enhanced = enhanceOpenApiDocument({
      openapi: '3.0.0',
      info: { title: 'Contract', version: '1' },
      paths: {
        '/cart': {
          get: {
            operationId: 'CommerceController_cart',
            responses: {
              '200': {
                description: '',
                content: { 'application/json': { schema: { type: 'object' } } },
              },
            },
          },
        },
      },
    });
    expect(enhanced.paths['/cart'].get?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CommerceController_cartResponse' },
        },
      },
    });
  });

  it('publishes date-time from the DTO before enhancement, including nullable PATCH dates', () => {
    expect(document.components?.schemas?.CreateEventDto).toMatchObject({
      properties: {
        startsAt: { type: 'string', format: 'date-time' },
        endsAt: { type: 'string', format: 'date-time' },
      },
    });
    expect(document.components?.schemas?.UpdateTicketTypeDto).toMatchObject({
      properties: { saleStartAt: { type: 'string', nullable: true, format: 'date-time' } },
    });
  });

  it('blocks regressions in the generation gate instead of repairing the published schema', () => {
    const { checkRequestSchemas } = require('../../../scripts/check-openapi.cjs') as {
      checkRequestSchemas: (models: Type<unknown>[], schemas: object) => { failures: string[] };
    };
    const schemas = structuredClone(document.components!.schemas!) as Record<
      string,
      { properties: Record<string, { type?: string; nullable?: boolean; enum?: unknown[] }> }
    >;
    schemas.UpdateEventDto.properties.capacity.type = 'number';
    schemas.UpdateEventDto.properties.description.nullable = false;
    schemas.ListWithdrawalsDto.properties.status.enum = ['INVALID'];
    const result = checkRequestSchemas([UpdateEventDto, ListWithdrawalsDto], schemas);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ListWithdrawalsDto.status'),
        expect.stringContaining('UpdateEventDto.capacity'),
        expect.stringContaining('UpdateEventDto.description'),
      ]),
    );
  });
});
