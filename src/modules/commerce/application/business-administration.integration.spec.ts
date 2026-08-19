/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { UserRole, WorkerPermission } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ClubsService } from '../../clubs/application/clubs.service';
import { SimulatedPaymentGateway } from '../infrastructure/simulated-payment.gateway';
import { CommerceService } from './commerce.service';

jest.setTimeout(180_000);

describe('Module 8 - business administration', () => {
  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const uploads = { createReadableImageUrl: jest.fn(async (value: string | null) => value) };
  const commerce = new CommerceService(
    prisma,
    config,
    uploads as any,
    new SimulatedPaymentGateway(),
  );
  const clubs = new ClubsService(prisma, config, uploads as any);
  const suffix = randomUUID().slice(0, 8);
  let adminId: string;
  let workerId: string;
  let customerId: string;
  let clubId: string;
  let orderId: string;
  let productId: string;
  let eventId: string;

  const admin = () => ({ id: adminId, role: UserRole.ADMIN });
  const worker = () => ({ id: workerId, role: UserRole.WORKER });

  beforeAll(async () => {
    await prisma.$connect();
    const stamp = Date.now().toString().slice(-7);
    const [adminUser, workerUser, customer] = await Promise.all([
      prisma.user.create({ data: { phoneCountryCode: '+51', phoneNumber: `91${stamp}`, passwordHash: 'test', fullName: `Admin ${suffix}`, status: 'ACTIVE', role: 'ADMIN' } }),
      prisma.user.create({ data: { phoneCountryCode: '+51', phoneNumber: `92${stamp}`, passwordHash: 'test', fullName: `Worker ${suffix}`, status: 'ACTIVE', role: 'WORKER' } }),
      prisma.user.create({ data: { phoneCountryCode: '+51', phoneNumber: `93${stamp}`, passwordHash: 'test', fullName: `Customer ${suffix}`, email: `${suffix}@module8.test`, status: 'ACTIVE' } }),
    ]);
    adminId = adminUser.id; workerId = workerUser.id; customerId = customer.id;
    const club = await prisma.club.create({ data: { name: `Module 8 ${suffix}`, status: 'ACTIVE' } });
    clubId = club.id;
    await prisma.clubAdmin.create({ data: { clubId, userId: adminId } });
    await prisma.clubWorker.create({
      data: {
        clubId, userId: workerId, roleLabel: 'Supervisor',
        permissions: [WorkerPermission.VIEW_SALES, WorkerPermission.REQUEST_REFUNDS, WorkerPermission.VIEW_OPERATIONS],
      },
    });
    const event = await prisma.event.create({ data: { clubId, name: `Event ${suffix}`, startsAt: new Date(), endsAt: new Date(Date.now() + 3_600_000), capacity: 100, status: 'IN_PROGRESS' } });
    eventId = event.id;
    const product = await prisma.product.create({ data: { clubId, name: `Low stock ${suffix}`, priceCents: 1500, stockQuantity: 3, status: 'ACTIVE' } });
    productId = product.id;
    const order = await prisma.order.create({
      data: {
        clubId, userId: customerId, status: 'PAID', totalCents: 3000, paidAt: new Date(),
        items: { create: { clubId, itemType: 'PRODUCT', itemId: productId, nameSnapshot: product.name, quantity: 2, unitPriceCents: 1500, totalCents: 3000 } },
        paymentAttempts: { create: { provider: 'simulated', status: 'APPROVED', amountCents: 3000, approvedAt: new Date() } },
      },
    });
    orderId = order.id;
    await prisma.qrValidationAttempt.create({ data: { clubId, actorUserId: workerId, outcome: 'VALID', codeFingerprint: suffix } });
  });

  afterAll(async () => {
    await prisma.refundRequest.deleteMany({ where: { clubId } });
    await prisma.auditLogEntry.deleteMany({ where: { clubId } });
    await prisma.qrValidationAttempt.deleteMany({ where: { clubId } });
    await prisma.paymentAttempt.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.clubOperationalProfile.deleteMany({ where: { clubId } });
    await prisma.clubWorker.deleteMany({ where: { clubId } });
    await prisma.clubAdmin.deleteMany({ where: { clubId } });
    await prisma.club.delete({ where: { id: clubId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, workerId, customerId] } } });
    await prisma.$disconnect();
  });

  it('lists and filters real orders with customer, items and payment', async () => {
    const result = await commerce.listClubOrders(worker(), clubId, { status: 'PAID', productId });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].user.email).toBe(`${suffix}@module8.test`);
    expect(result.items[0].items[0].itemId).toBe(productId);
    expect(result.items[0].paymentAttempts[0].status).toBe('APPROVED');
    expect(result.summary.salesCents).toBe(3000);
  });

  it('returns detail and exports the same real sale as CSV', async () => {
    const detail = await commerce.getClubOrder(admin(), clubId, orderId);
    const exported = await commerce.exportClubOrders(admin(), clubId, { productId });
    expect(detail.order.id).toBe(orderId);
    expect(exported).toContain(orderId);
    expect(exported).toContain(`Low stock ${suffix}`);
  });

  it('enforces worker permissions and creates one auditable refund request', async () => {
    const request = await commerce.requestOrderRefund(worker(), clubId, orderId, 'El cliente solicitó la devolución de su compra.');
    expect(request.refundRequest.status).toBe('REQUESTED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('REFUND_PENDING');
    expect(await prisma.auditLogEntry.count({ where: { resourceId: orderId, action: 'REQUEST_ORDER_REFUND' } })).toBe(1);
    await expect(commerce.requestOrderRefund(worker(), clubId, orderId, 'Segundo intento de devolución no permitido.')).rejects.toBeDefined();
  });

  it('reports real stock, capacity, validations, workers and devices', async () => {
    const operations = await commerce.getClubOperations(worker(), clubId);
    expect(operations.inventory.lowStock.map((item) => item.id)).toContain(productId);
    expect(operations.events.find((item) => item.id === eventId)?.capacity).toBe(100);
    expect(operations.validationsToday.VALID).toBeGreaterThanOrEqual(1);
    expect(operations.workers.find((item) => item.id)?.name).toContain('Worker');
  });

  it('persists refund policy, responsible contact and approval documents', async () => {
    const documentId = randomUUID();
    await clubs.updateOperationalProfile(admin(), clubId, {
      refundPolicy: 'Devoluciones evaluadas dentro de cinco días hábiles.',
      responsibleName: 'Responsable Operativo',
      responsibleEmail: 'operaciones@beerry.test',
      responsiblePhone: '+51987654321',
      approvalDocumentUploadIds: [documentId],
    });
    const result = await clubs.getOperationalProfile(admin(), clubId);
    expect(result.profile?.refundPolicy).toContain('cinco días');
    expect(result.profile?.approvalDocumentUploadIds).toEqual([documentId]);
  });
});
