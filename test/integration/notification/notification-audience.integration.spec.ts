/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { NotificationAudience, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { NotificationService } from '@modules/notification/application/notification.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

jest.setTimeout(30_000);

describe('Notification audience isolation (PostgreSQL)', () => {
  const prisma = new PrismaService(new ConfigService());
  const service = new NotificationService(prisma, { send: jest.fn() }, { send: jest.fn() });
  const ids: string[] = [];
  beforeAll(() => prisma.$connect());
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    ids.length = 0;
  });
  afterAll(() => prisma.$disconnect());

  async function user(role: 'WORKER' | 'CUSTOMER' | 'ADMIN' = 'WORKER') {
    const value = await prisma.user.create({
      data: {
        role,
        status: 'ACTIVE',
        phoneCountryCode: '+51',
        phoneNumber: randomUUID(),
        passwordHash: 'test',
        fullName: 'Audience test',
      },
    });
    ids.push(value.id);
    return value.id;
  }
  async function notice(
    userId: string,
    audience: NotificationAudience,
    extra: Partial<Prisma.NotificationUncheckedCreateInput> = {
      userId,
      category: 'ORDER',
      title: 'Aviso',
      body: 'Detalle',
    },
    visible = true,
  ) {
    return prisma.notification.create({
      data: {
        userId,
        category: 'ORDER',
        title: 'Aviso',
        body: 'Detalle',
        ...extra,
        audience,
        deliveries: {
          create: { channel: 'IN_APP', status: visible ? 'SENT' : 'SKIPPED', provider: 'internal' },
        },
      },
    });
  }

  it('separates purchases and VIEW_SALES notices for the same worker, with global per-audience counters', async () => {
    const worker = await user();
    const other = await user('CUSTOMER');
    const customer = await notice(worker, 'CUSTOMER');
    const operations = await notice(worker, 'OPERATIONS');
    await notice(worker, 'OPERATIONS', {
      userId: worker,
      category: 'EVENT',
      title: 'Evento',
      body: 'Detalle',
    });
    await notice(worker, 'CUSTOMER', undefined, false);
    await notice(other, 'OPERATIONS');
    const result = await service.list(worker, { audience: 'CUSTOMER' });
    expect(result.items.map((row) => row.id)).toEqual([customer.id]);
    expect(result).toMatchObject({ unreadCount: 1, unreadCounts: { customer: 1, operations: 2 } });
    const filtered = await service.list(worker, {
      audience: 'OPERATIONS',
      category: 'ORDER',
      readStatus: 'read',
    });
    expect(filtered.items).toEqual([]);
    expect(filtered).toMatchObject({
      unreadCount: 2,
      unreadCounts: { customer: 1, operations: 2 },
    });
    const combined = await service.list(worker);
    expect(combined.items.map((row) => row.id)).toEqual(
      expect.arrayContaining([customer.id, operations.id]),
    );
    expect(combined.unreadCount).toBe(3);
    await prisma.user.update({ where: { id: worker }, data: { role: 'CUSTOMER' } });
    expect((await service.list(worker, { audience: 'OPERATIONS' })).unreadCount).toBe(2);
  });

  it('read-all isolates selected audience and keeps notification ownership', async () => {
    const worker = await user();
    const other = await user();
    const own = await notice(worker, 'CUSTOMER');
    const hidden = await notice(worker, 'OPERATIONS', undefined, false);
    const work = await notice(worker, 'OPERATIONS');
    const foreign = await notice(other, 'OPERATIONS');
    expect(await service.markAllRead(worker, 'OPERATIONS')).toEqual({ updated: 1 });
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: work.id } })).readAt,
    ).not.toBeNull();
    for (const id of [own.id, hidden.id, foreign.id])
      expect((await prisma.notification.findUniqueOrThrow({ where: { id } })).readAt).toBeNull();
    await expect(service.markRead(worker, foreign.id)).rejects.toMatchObject({ status: 404 });
    expect(await service.markAllRead(worker)).toEqual({ updated: 1 });
  });

  it('paginates mixed history server-side and rejects cursors reused in another audience', async () => {
    const worker = await user();
    const expected: string[] = [];
    for (let index = 0; index < 8; index++) {
      const row = await notice(worker, index % 2 ? 'OPERATIONS' : 'CUSTOMER');
      if (index % 2) expected.unshift(row.id);
    }
    const first = await service.list(worker, { audience: 'OPERATIONS', limit: 2 });
    const second = await service.list(worker, {
      audience: 'OPERATIONS',
      limit: 2,
      cursor: first.nextCursor!,
    });
    expect([...first.items, ...second.items].map((row) => row.id)).toEqual(expected);
    expect(second.nextCursor).toBeNull();
    await expect(
      service.list(worker, { audience: 'CUSTOMER', cursor: first.nextCursor! }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(service.list(worker, { cursor: first.nextCursor! })).rejects.toMatchObject({
      status: 400,
    });
    const legacy = Buffer.from(
      JSON.stringify({
        createdAt: first.items[0]!.createdAt.toISOString(),
        id: first.items[0]!.id,
      }),
    ).toString('base64url');
    await expect(service.list(worker, { cursor: legacy })).resolves.toBeDefined();
    await expect(
      service.list(worker, { audience: 'OPERATIONS', cursor: legacy }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('backfills historical template versions and manual reviews without relabeling customer events by account role', async () => {
    const admin = await user('ADMIN');
    const readAt = new Date('2026-01-01T00:00:00Z');
    const fixtures = [
      {
        templateKey: 'ADMIN_NEW_SALE',
        templateVersion: 8,
        deepLink: '/admin/sales',
        expected: 'OPERATIONS',
      },
      { templateKey: 'PAYMENT_APPROVED', deepLink: '/orders/legacy', expected: 'CUSTOMER' },
      { templateKey: 'BUSINESS_ACCESS_APPROVED', expected: 'OPERATIONS' },
      { category: 'EVENT', data: { buyerRefundRequestId: 'review' }, expected: 'OPERATIONS' },
      {
        category: 'EVENT',
        data: { eventId: 'event', cancellationId: 'review' },
        expected: 'OPERATIONS',
      },
      {
        category: 'EVENT',
        data: { eventId: 'purchased' },
        deepLink: 'beerry://admin/club/events/purchased',
        expected: 'CUSTOMER',
      },
      { category: 'SYSTEM', deepLink: 'beerry://worker/sales', expected: 'OPERATIONS' },
      { category: 'ORDER', expected: 'CUSTOMER' },
    ] as const;
    const rows = [];
    for (const { expected, ...data } of fixtures)
      rows.push({
        row: await notice(admin, 'CUSTOMER', {
          userId: admin,
          category: 'ORDER',
          title: 'Histórico',
          body: 'Detalle',
          readAt,
          ...data,
        }),
        expected,
      });
    const worker = await user('WORKER');
    const workerRequest = await notice(worker, 'CUSTOMER', {
      templateKey: 'BUSINESS_ACCESS_REJECTED',
    });
    const migration = readFileSync(
      'prisma/migrations/20260929000100_notification_audience/migration.sql',
      'utf8',
    );
    const updates = [...migration.matchAll(/UPDATE "Notification" n SET[\s\S]*?;/g)];
    expect(updates).toHaveLength(3);
    for (const [statement] of updates) await prisma.$executeRawUnsafe(statement);
    for (const { row, expected } of rows)
      expect(await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
        audience: expected,
        readAt,
        title: 'Histórico',
      });
    expect(
      await prisma.notification.findUniqueOrThrow({ where: { id: workerRequest.id } }),
    ).toMatchObject({ audience: 'CUSTOMER' });
    const adminRequest = rows.find(({ row }) => row.templateKey === 'BUSINESS_ACCESS_APPROVED');
    expect(
      await prisma.notification.findUniqueOrThrow({ where: { id: adminRequest!.row.id } }),
    ).toMatchObject({ deepLink: '/admin/profile/business-access' });
    const legacyBuyer = rows.find(
      ({ row }) => row.deepLink === 'beerry://admin/club/events/purchased',
    );
    expect(
      await prisma.notification.findUniqueOrThrow({ where: { id: legacyBuyer!.row.id } }),
    ).toMatchObject({ deepLink: 'beerry://customer/qrs?filter=HISTORY' });
    const legacySale = rows.find(({ row }) => row.templateKey === 'ADMIN_NEW_SALE');
    expect(
      await prisma.notification.findUniqueOrThrow({ where: { id: legacySale!.row.id } }),
    ).toMatchObject({ deepLink: '/admin/sales' });
    expect(await prisma.notification.count({ where: { userId: admin } })).toBe(fixtures.length);
  });
});
