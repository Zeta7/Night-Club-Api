/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { NotificationService } from '@modules/notification/application/notification.service';
import { ListNotificationsQueryDto } from '@modules/notification/presentation/notification.dto';

describe('Notification inbox pagination integration', () => {
  const prisma = new PrismaService(new ConfigService());
  const service = new NotificationService(prisma, { send: jest.fn() }, { send: jest.fn() });
  const userIds: string[] = [];

  beforeAll(() => prisma.$connect());
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function user() {
    const value = await prisma.user.create({
      data: {
        phoneCountryCode: '+51',
        phoneNumber: randomUUID(),
        passwordHash: 'test',
        fullName: 'Notification pagination',
        status: 'ACTIVE',
      },
    });
    userIds.push(value.id);
    return value.id;
  }

  async function notification(
    userId: string,
    data: {
      category?: 'PAYMENT' | 'QR';
      readAt?: Date;
      visible?: boolean;
    } = {},
  ) {
    return prisma.notification.create({
      data: {
        userId,
        category: data.category ?? 'PAYMENT',
        title: 'Aviso',
        body: 'Detalle',
        readAt: data.readAt,
        deliveries: {
          create: {
            channel: 'IN_APP',
            provider: 'internal',
            status: data.visible === false ? 'SKIPPED' : 'SENT',
          },
        },
      },
    });
  }

  it('reaches beyond 100 without duplicates or omissions when new alerts arrive and the cursor row is deleted', async () => {
    const userId = await user();
    const prefix = randomUUID();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const ids = Array.from(
      { length: 125 },
      (_, index) => `${prefix}-${String(index).padStart(3, '0')}`,
    );
    await prisma.notification.createMany({
      data: ids.map((id) => ({
        id,
        userId,
        category: 'PAYMENT',
        title: 'Aviso',
        body: 'Detalle',
        createdAt,
      })),
    });
    await prisma.notificationDelivery.createMany({
      data: ids.map((notificationId) => ({
        notificationId,
        channel: 'IN_APP',
        status: 'SENT',
        provider: 'internal',
      })),
    });
    const legacy = await service.list(userId);
    expect(legacy.items).toHaveLength(100);
    expect(legacy.nextCursor).not.toBeNull();

    const first = await service.list(userId, { limit: 30 });
    expect(first.items).toHaveLength(30);
    expect(first.unreadCount).toBe(125);
    const seen = first.items.map((item) => item.id);
    const inserted = await notification(userId);
    await prisma.notification.delete({ where: { id: seen.at(-1)! } });
    let cursor = first.nextCursor;
    for (let page = 0; cursor !== null && page < 10; page++) {
      const next = await service.list(userId, { limit: 30, cursor });
      seen.push(...next.items.map((item) => item.id));
      cursor = next.nextCursor;
    }
    expect(cursor).toBeNull();
    expect(seen).toEqual([...ids].sort().reverse());
    expect(new Set(seen).size).toBe(125);
    expect(seen).not.toContain(inserted.id);
    expect((await service.list(userId, { limit: 30 })).items[0]?.id).toBe(inserted.id);
  });

  it('keeps ownership, category, read status and visibility on every page with a global unread count', async () => {
    const owner = await user();
    const other = await user();
    const expected = await Promise.all([
      notification(owner, { category: 'QR', readAt: new Date() }),
      notification(owner, { category: 'QR', readAt: new Date() }),
    ]);
    await notification(owner, { category: 'QR' });
    await notification(owner, { category: 'PAYMENT' });
    await notification(owner, { category: 'QR', visible: false });
    await notification(other, { category: 'QR', readAt: new Date() });
    const first = await service.list(owner, { limit: 1, category: 'QR', readStatus: 'read' });
    const second = await service.list(owner, {
      limit: 1,
      category: 'QR',
      readStatus: 'read',
      cursor: first.nextCursor!,
    });
    expect([...first.items, ...second.items].map((item) => item.id).sort()).toEqual(
      expected.map((item) => item.id).sort(),
    );
    expect(first.unreadCount).toBe(2);
    expect(second.unreadCount).toBe(2);
    expect(second.nextCursor).toBeNull();
    expect(
      (await service.list(other, { cursor: first.nextCursor!, category: 'PAYMENT' })).items,
    ).toEqual([]);
  });

  it.each([
    '',
    'invalid!',
    Buffer.from('{}').toString('base64url'),
    Buffer.from(JSON.stringify({ id: 'id', createdAt: 'invalid' })).toString('base64url'),
  ])('rejects malformed cursor %s before querying', async (cursor) => {
    await expect(service.list('no-user', { cursor })).rejects.toMatchObject({ status: 400 });
  });

  it('validates bounded integer limits in the HTTP query contract', async () => {
    for (const limit of ['0', '101', '1.5', 'invalid', '']) {
      expect(
        await validate(plainToInstance(ListNotificationsQueryDto, { limit })),
      ).not.toHaveLength(0);
    }
    for (const limit of ['1', '30', '100']) {
      const query = plainToInstance(ListNotificationsQueryDto, { limit });
      expect(await validate(query)).toHaveLength(0);
      expect(query.limit).toBe(Number(limit));
    }
  });
});
