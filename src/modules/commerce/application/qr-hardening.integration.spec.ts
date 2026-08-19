/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { CommerceItemType, UserRole } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { UploadsService } from '../../uploads/application/uploads.service';
import { SimulatedPaymentGateway } from '../infrastructure/simulated-payment.gateway';
import { CommerceService } from './commerce.service';

jest.setTimeout(180_000);

describe('Module 4 - hardened QR redemption', () => {
  process.env.QR_SIGNING_ACTIVE_VERSION = 'v1';
  process.env.QR_SIGNING_KEYS_JSON = JSON.stringify({
    v1: 'module-4-integration-secret-with-more-than-32-characters',
  });

  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const gateway = new SimulatedPaymentGateway();
  const uploads = { createReadableImageUrl: jest.fn(async () => null) } as unknown as UploadsService;
  const service = new CommerceService(prisma, config, uploads, gateway, undefined);
  const suffix = randomUUID().slice(0, 8);
  let customerId: string;
  let adminId: string;
  let clubId: string;
  let otherClubId: string;
  let ticketTypeId: string;

  const customer = () => ({ id: customerId, role: UserRole.CUSTOMER });
  const admin = () => ({ id: adminId, role: UserRole.ADMIN });

  beforeAll(async () => {
    await prisma.$connect();
    const [customerUser, adminUser] = await Promise.all([
      prisma.user.create({
        data: {
          phoneCountryCode: '+51', phoneNumber: `91${Date.now().toString().slice(-7)}`,
          passwordHash: 'test', fullName: `QR Customer ${suffix}`, status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          phoneCountryCode: '+51', phoneNumber: `92${Date.now().toString().slice(-7)}`,
          passwordHash: 'test', fullName: `QR Admin ${suffix}`, status: 'ACTIVE', role: 'ADMIN',
        },
      }),
    ]);
    customerId = customerUser.id;
    adminId = adminUser.id;
    const [club, otherClub] = await Promise.all([
      prisma.club.create({ data: { name: `QR Club ${suffix}`, status: 'ACTIVE' } }),
      prisma.club.create({ data: { name: `Other QR Club ${suffix}`, status: 'ACTIVE' } }),
    ]);
    clubId = club.id;
    otherClubId = otherClub.id;
    await Promise.all([
      prisma.clubAdmin.create({ data: { clubId, userId: adminId } }),
      prisma.clubAdmin.create({ data: { clubId: otherClubId, userId: adminId } }),
    ]);
    const ticketType = await prisma.ticketType.create({
      data: {
        clubId, name: `QR Entry ${suffix}`, priceCents: 2500,
        quantityTotal: 50, status: 'ACTIVE',
      },
    });
    ticketTypeId = ticketType.id;
  });

  afterAll(async () => {
    await prisma.qrValidationAttempt.deleteMany({ where: { clubId: { in: [clubId, otherClubId] } } });
    await prisma.auditLogEntry.deleteMany({ where: { clubId: { in: [clubId, otherClubId] } } });
    await prisma.ticket.deleteMany({ where: { ownerUserId: customerId } });
    await prisma.order.deleteMany({ where: { userId: customerId } });
    await prisma.cart.deleteMany({ where: { userId: customerId } });
    await prisma.wallet.deleteMany({ where: { userId: customerId } });
    await prisma.ticketType.deleteMany({ where: { id: ticketTypeId } });
    await prisma.clubAdmin.deleteMany({ where: { userId: adminId } });
    await prisma.club.deleteMany({ where: { id: { in: [clubId, otherClubId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [customerId, adminId] } } });
    await prisma.$disconnect();
  });

  async function issueTicket() {
    await service.addCartItem(customer(), { id: ticketTypeId, type: CommerceItemType.TICKET, quantity: 1 });
    const checkout = await service.checkout(customer(), { expectedTotalCents: 2500 });
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: checkout.paymentAttemptId } });
    await service.processPaymentEvent(gateway.createSimulatedEvent(attempt.externalPaymentId!, 'APPROVED'));
    return prisma.ticket.findFirstOrThrow({ where: { orderId: checkout.orderId } });
  }

  it('rejects a manipulated QR and records an INVALID attempt', async () => {
    const ticket = await issueTicket();
    const last = ticket.qrPayload.at(-1)!;
    const manipulated = `${ticket.qrPayload.slice(0, -1)}${last === 'a' ? 'b' : 'a'}`;
    const result = await service.validateCode(admin(), clubId, 'TICKET', manipulated, true);
    expect(result.validation.isValid).toBe(false);
    expect(await prisma.qrValidationAttempt.count({
      where: { resourceId: ticket.id, outcome: 'INVALID', reasonCode: 'INVALID_SIGNATURE' },
    })).toBe(1);
  });

  it('rejects a QR presented at another business', async () => {
    const ticket = await issueTicket();
    const result = await service.validateDetectedCode(admin(), otherClubId, ticket.qrPayload, true);
    expect(result.validation.isValid).toBe(false);
    expect(result.validation.statusLabel).toContain('NO ENCONTRADO');
  });

  it('rejects a refunded/revoked QR', async () => {
    const ticket = await issueTicket();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'CANCELLED', revokedAt: new Date(), revokedReason: 'PAYMENT_REFUNDED' },
    });
    const result = await service.validateCode(admin(), clubId, 'TICKET', ticket.qrPayload, true);
    expect(result.validation.isValid).toBe(false);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).redemptionCount).toBe(0);
  });

  it('allows only one winner when two devices redeem the same QR', async () => {
    const ticket = await issueTicket();
    const results = await Promise.allSettled([
      service.validateCode(admin(), clubId, 'TICKET', ticket.qrPayload, true),
      service.validateCode(admin(), clubId, 'TICKET', ticket.qrPayload, true),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(stored.redemptionCount).toBe(1);
    expect(stored.status).toBe('USED');
  });

  it('shares redemption state between backup code and signed QR', async () => {
    const ticket = await issueTicket();
    const first = await service.validateCode(admin(), clubId, 'TICKET', ticket.code, true);
    const repeated = await service.validateCode(admin(), clubId, 'TICKET', ticket.qrPayload, true);
    expect(first.validation.isValid).toBe(true);
    expect(repeated.validation.isValid).toBe(false);
    expect(repeated.validation.statusLabel).toContain('YA UTILIZADO');
  });

  it('supports a supervised reversal and records it', async () => {
    const ticket = await issueTicket();
    await service.validateCode(admin(), clubId, 'TICKET', ticket.code, true);
    const reversal = await service.reverseRedemption(admin(), clubId, 'TICKET', ticket.id, 'Error operativo confirmado');
    expect(reversal.reversed).toBe(true);
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(stored.status).toBe('AVAILABLE');
    expect(stored.redemptionCount).toBe(0);
    expect(await prisma.qrValidationAttempt.count({ where: { resourceId: ticket.id, outcome: 'REVERSED' } })).toBe(1);
  });
});
