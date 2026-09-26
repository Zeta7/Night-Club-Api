/// <reference types="jest" />
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ClubStatus, EventStatus } from '@prisma/client';
import {
  readClubAddress,
  readClubContact,
  readClubSchedule,
  readClubSocialMedia,
} from '../../../src/modules/clubs/application/club-profile';
import { ClubResponseDto } from '../../../src/modules/clubs/presentation/clubs.response.dto';
import { CustomerHomeResponseDto } from '../../../src/modules/clubs/presentation/customer-discovery.response.dto';
import { ClubWorkersResponseDto } from '../../../src/modules/clubs/presentation/worker.response.dto';
import { readEventSnapshot } from '../../../src/modules/commerce/application/order-snapshot';
import {
  CheckoutResponseDto,
  ReservationMetricsResponseDto,
  SimulatedPaymentResponseDto,
} from '../../../src/modules/commerce/presentation/commerce.response.dto';
import { EventRefundJobsResponseDto } from '../../../src/modules/commerce/presentation/event-resolution.response.dto';
import { OwnedConsumablesResponseDto } from '../../../src/modules/commerce/presentation/owned-resources.response.dto';
import { EventResponseDto } from '../../../src/modules/events/presentation/events.response.dto';
import { LoginResponseDto } from '../../../src/modules/identity/presentation/identity.response.dto';
import { PromotionsResponseDto } from '../../../src/modules/promotions/presentation/promotions.response.dto';
import {
  WalletMovementResponseDto,
  WalletResponseDto,
} from '../../../src/modules/wallets/presentation/wallets.response.dto';

@Module({})
class ContractModule {}

describe('Public response contracts', () => {
  let document: OpenAPIObject;

  beforeAll(async () => {
    const app = await NestFactory.create(ContractModule, { logger: false });
    try {
      document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
        extraModels: [
          ClubResponseDto,
          CustomerHomeResponseDto,
          EventResponseDto,
          LoginResponseDto,
          ReservationMetricsResponseDto,
          CheckoutResponseDto,
          SimulatedPaymentResponseDto,
          OwnedConsumablesResponseDto,
          EventRefundJobsResponseDto,
          WalletMovementResponseDto,
          WalletResponseDto,
          ClubWorkersResponseDto,
          PromotionsResponseDto,
        ],
      });
    } finally {
      await app.close();
    }
  });

  it('publishes shared named models and enums for the SDK', () => {
    expect(document.components?.schemas?.ClubResponseDto).toMatchObject({
      properties: { club: { $ref: '#/components/schemas/ClubDto' } },
      required: ['message', 'club'],
    });
    expect(document.components?.schemas?.ClubStatus).toMatchObject({
      enum: Object.values(ClubStatus),
    });
    expect(document.components?.schemas?.EventStatus).toMatchObject({
      enum: Object.values(EventStatus),
    });
    expect(document.components?.schemas?.LoginResponseDto).toMatchObject({
      properties: { user: { $ref: '#/components/schemas/UserProfileDto' } },
    });
  });

  it('publishes typed Home availability, counts and empty reasons', () => {
    expect(document.components?.schemas?.CustomerHomeResponseDto).toMatchObject({
      properties: {
        clubs: { type: 'array', items: { $ref: '#/components/schemas/CustomerHomeClubDto' } },
        counts: { allOf: [{ $ref: '#/components/schemas/CustomerHomeCountsDto' }] },
        emptyReasons: { allOf: [{ $ref: '#/components/schemas/CustomerHomeEmptyReasonsDto' }] },
      },
    });
    expect(document.components?.schemas?.CustomerHomeClubDto).toMatchObject({
      properties: {
        commerceStatus: { allOf: [{ $ref: '#/components/schemas/CustomerCommerceStatus' }] },
        emptyReason: {
          nullable: true,
          allOf: [{ $ref: '#/components/schemas/CustomerClubEmptyReason' }],
        },
      },
    });
    expect(document.components?.schemas?.CustomerHomeEmptyReason).toMatchObject({
      enum: [
        'NO_ACTIVE_CLUBS_IN_SCOPE',
        'PAYMENTS_UNAVAILABLE',
        'NO_VISIBLE_EVENTS',
        'NO_ACTIVE_PROMOTIONS',
      ],
    });
    expect(document.components?.schemas?.CustomerHomeResponseDto).toMatchObject({
      properties: {
        featuredItems: {
          type: 'array',
          items: {
            oneOf: [
              { $ref: '#/components/schemas/CustomerHomeFeaturedClubDto' },
              { $ref: '#/components/schemas/CustomerHomeFeaturedEventDto' },
            ],
            discriminator: {
              propertyName: 'targetType',
              mapping: {
                BUSINESS: '#/components/schemas/CustomerHomeFeaturedClubDto',
                EVENT: '#/components/schemas/CustomerHomeFeaturedEventDto',
              },
            },
          },
        },
        events: { type: 'array', items: { $ref: '#/components/schemas/CustomerHomeEventDto' } },
      },
    });
    expect(document.components?.schemas?.CustomerHomeFeaturedEventDto).toMatchObject({
      properties: {
        targetId: { type: 'string' },
        eventId: { type: 'string' },
        title: { type: 'string' },
        imageUrl: { type: 'string' },
      },
    });
    expect(document.components?.schemas?.CustomerHomeEventDto).toMatchObject({
      properties: {
        available: { type: 'integer' },
        accessStatus: { enum: ['AVAILABLE', 'UNAVAILABLE', 'SOLD_OUT', 'INFORMATIONAL'] },
      },
    });
  });

  it('publishes concrete club profile fields instead of opaque JSON', () => {
    expect(document.components?.schemas?.ClubDto).toMatchObject({
      properties: {
        address: { $ref: '#/components/schemas/ClubAddressResponseDto' },
        contact: { $ref: '#/components/schemas/ClubContactResponseDto' },
        socialMedia: {
          type: 'array',
          items: { $ref: '#/components/schemas/ClubSocialMediaResponseDto' },
        },
        schedule: {
          type: 'array',
          items: { $ref: '#/components/schemas/ClubScheduleResponseDto' },
        },
      },
    });
    expect(document.components?.schemas?.ClubContactResponseDto).toMatchObject({
      properties: { phone: { type: 'string' }, email: { type: 'string' } },
      required: ['phone', 'email'],
    });
  });

  it('distinguishes nullable fields and publishes dates and integer amounts accurately', () => {
    expect(document.components?.schemas?.EventDto).toMatchObject({
      properties: {
        description: { type: 'string', nullable: true },
        startsAt: { type: 'string', format: 'date-time' },
      },
    });
    expect(document.components?.schemas?.ReservationMetricsResponseDto).toMatchObject({
      properties: {
        statuses: {
          type: 'object',
          additionalProperties: { $ref: '#/components/schemas/ReservationCountsDto' },
        },
      },
    });
    expect(document.components?.schemas?.ReservationCountsDto).toMatchObject({
      properties: { reservations: { type: 'integer' }, units: { type: 'integer' } },
    });
  });

  it('normalizes stored JSON to the promised profile contract without trusting a type assertion', () => {
    expect(readClubContact({ phone: '+51987654321', email: null })).toEqual({
      phone: '+51987654321',
      email: '',
    });
    expect(readClubContact(['invalid'])).toEqual({ phone: '', email: '' });
    expect(
      readClubAddress({ location: 'Lima', latitude: -12.1, longitude: 'invalid' }),
    ).toMatchObject({
      location: 'Lima',
      latitude: -12.1,
      longitude: null,
    });
    expect(
      readClubSchedule([null, { day: 'friday', isOpen: true, openTime: '22:00', closeTime: null }]),
    ).toEqual([{ day: 'friday', isOpen: true, openTime: '22:00', closeTime: '' }]);
    expect(
      readClubSocialMedia([null, { type: 'instagram', url: 'https://instagram.com/club' }]),
    ).toEqual([{ type: 'instagram', url: 'https://instagram.com/club' }]);
  });

  it('keeps decimal money and separates promotion states from worker states', () => {
    expect(document.components?.schemas?.CheckoutResponseDto).toMatchObject({
      properties: { total: { type: 'number' } },
    });
    expect(document.components?.schemas?.WalletCreditDto).toMatchObject({
      properties: { available: { type: 'number' } },
    });
    expect(document.components?.schemas?.PromotionDto).toMatchObject({
      properties: { status: { allOf: [{ $ref: '#/components/schemas/PromotionStatus' }] } },
    });
    expect(document.components?.schemas?.ClubWorkerDto).toMatchObject({
      properties: {
        status: { allOf: [{ $ref: '#/components/schemas/ClubWorkerStatus' }] },
        permissions: { type: 'array', items: { $ref: '#/components/schemas/WorkerPermission' } },
      },
    });
  });

  it('publishes concrete payloads for orders, top-ups, entitlements and refund jobs', () => {
    expect(document.components?.schemas?.SimulatedPaymentResponseDto).toMatchObject({
      required: ['order', 'topUp'],
      properties: {
        order: { nullable: true, allOf: [{ $ref: '#/components/schemas/CheckoutResponseDto' }] },
        topUp: { nullable: true, allOf: [{ $ref: '#/components/schemas/WalletTopUpResponseDto' }] },
      },
    });
    expect(document.components?.schemas?.OwnedConsumablesResponseDto).toMatchObject({
      required: ['rights', 'deliveries'],
    });
    expect(document.components?.schemas?.EventRefundJobsResponseDto).toMatchObject({
      required: ['jobs', 'unallocatedRefunds'],
    });
    expect(document.components?.schemas?.WalletMovementRelatedDto).toMatchObject({
      required: ['order', 'topUp'],
    });
  });

  it('preserves historical snapshots without inventing dates or leaking arbitrary JSON', () => {
    expect(readEventSnapshot({ source: 'HISTORICAL_RIGHTS' })).toEqual({
      source: 'HISTORICAL_RIGHTS',
    });
    expect(
      readEventSnapshot({
        source: 'CHECKOUT',
        name: 'Fiesta',
        startsAt: '2026-09-27T00:00:00.000Z',
        other: 1,
      }),
    ).toEqual({
      source: 'CHECKOUT',
      name: 'Fiesta',
      startsAt: '2026-09-27T00:00:00.000Z',
    });
    expect(readEventSnapshot({ name: 'Sin origen' })).toBeNull();
    expect(readEventSnapshot(null)).toBeNull();
  });
});
