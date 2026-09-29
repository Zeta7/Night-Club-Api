/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { EventsService } from '@modules/events/application/events.service';
import { NotificationService } from '@modules/notification/application/notification.service';
import { NotificationChannelMessage } from '@modules/notification/application/ports/notification-channel.port';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

jest.setTimeout(30_000);

describe('Transactional event notification outbox (PostgreSQL)', () => {
  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const send = jest.fn(async (message: NotificationChannelMessage) => ({
    provider: 'integration',
    sentTokens: message.deviceTokens,
    invalidTokens: [],
    retryTokens: [],
  }));
  const service = new NotificationService(prisma, { send: jest.fn() }, { send });
  const events = new EventsService(prisma, {} as never, config);
  const userIds: string[] = [];
  const clubIds: string[] = [];

  beforeAll(() => prisma.$connect());
  beforeEach(() => send.mockClear());
  afterEach(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLogEntry.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.ticket.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.consumableRight.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.order.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.ticketType.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.event.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.clubAdmin.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    userIds.length = 0;
    clubIds.length = 0;
  });
  afterAll(() => prisma.$disconnect());

  async function user(role: UserRole = UserRole.CUSTOMER) {
    const recipient = await prisma.user.create({
      data: {
        phoneCountryCode: '+51',
        phoneNumber: randomUUID(),
        passwordHash: 'integration-test',
        fullName: 'Event notification recipient',
        status: 'ACTIVE',
        role,
      },
    });
    userIds.push(recipient.id);
    return recipient;
  }

  async function fixture() {
    const admin = await user(UserRole.ADMIN);
    const club = await prisma.club.create({
      data: { name: 'Notification SQL club', status: 'ACTIVE' },
    });
    clubIds.push(club.id);
    await prisma.clubAdmin.create({ data: { clubId: club.id, userId: admin.id } });
    const event = await prisma.event.create({
      data: {
        clubId: club.id,
        name: 'Notification event',
        status: 'PUBLISHED',
        startsAt: new Date(Date.now() + 3_600_000),
        endsAt: new Date(Date.now() + 7_200_000),
        capacity: 20,
      },
    });
    const ticketType = await prisma.ticketType.create({
      data: {
        clubId: club.id,
        eventId: event.id,
        name: 'Admission',
        priceCents: 1000,
        quantityTotal: 20,
      },
    });
    return { admin, club, event, ticketType };
  }

  async function order(
    context: Awaited<ReturnType<typeof fixture>>,
    userId: string,
    status: OrderStatus,
    createdAt: Date,
  ) {
    return prisma.order.create({
      data: {
        userId,
        clubId: context.club.id,
        status,
        totalCents: 1000,
        createdAt,
        items: {
          create: {
            clubId: context.club.id,
            eventId: context.event.id,
            itemType: 'TICKET',
            itemId: context.ticketType.id,
            nameSnapshot: 'Admission',
            quantity: 1,
            unitPriceCents: 1000,
            totalCents: 1000,
          },
        },
      },
      include: { items: true },
    });
  }

  async function notice(userId: string, data: Prisma.InputJsonObject = {}, createdAt = new Date()) {
    return prisma.notification.create({
      data: {
        userId,
        category: 'EVENT',
        title: 'Event updated',
        body: 'Review your purchase',
        data,
        createdAt,
      },
    });
  }

  it('notifies buyers and transferred owners once, preferring a confirmed own purchase', async () => {
    const context = await fixture();
    const [buyer, transferred, pending, expired] = await Promise.all([
      user(),
      user(),
      user(),
      user(),
    ]);
    const paid = await order(context, buyer.id, 'PAID', new Date(Date.now() - 60_000));
    await order(context, buyer.id, 'PENDING', new Date(Date.now() - 30_000));
    await order(context, buyer.id, 'EXPIRED', new Date());
    const pendingOrder = await order(context, pending.id, 'PENDING', new Date());
    await order(context, expired.id, 'EXPIRED', new Date());
    const item = paid.items[0]!;
    await prisma.ticket.create({
      data: {
        orderId: paid.id,
        orderItemId: item.id,
        clubId: context.club.id,
        eventId: context.event.id,
        ticketTypeId: context.ticketType.id,
        ownerUserId: transferred.id,
        code: randomUUID(),
        qrPayload: randomUUID(),
      },
    });
    await prisma.consumableRight.create({
      data: {
        orderId: paid.id,
        orderItemId: item.id,
        clubId: context.club.id,
        eventId: context.event.id,
        ownerUserId: transferred.id,
        sourceType: 'TICKET',
        sourceId: context.ticketType.id,
        code: randomUUID(),
        qrPayload: randomUUID(),
      },
    });

    await events.postponeEvent(
      { id: context.admin.id, role: UserRole.ADMIN },
      context.club.id,
      context.event.id,
      { reason: 'Weather prevents the scheduled event' },
    );
    const notifications = await prisma.notification.findMany({
      where: { userId: { in: userIds } },
    });
    expect(notifications).toHaveLength(3);
    expect(notifications.find((item) => item.userId === buyer.id)?.data).toEqual({
      eventId: context.event.id,
      orderId: paid.id,
    });
    expect(notifications.find((item) => item.userId === pending.id)?.data).toEqual({
      eventId: context.event.id,
      orderId: pendingOrder.id,
    });
    expect(notifications.find((item) => item.userId === transferred.id)?.data).toEqual({
      eventId: context.event.id,
    });
    expect(notifications.some((item) => item.userId === expired.id)).toBe(false);

    await service.dispatchPending();
    expect((await service.list(buyer.id)).items[0]?.deepLink).toBe(
      `beerry://customer/operations/orders/${paid.id}`,
    );
    expect((await service.list(transferred.id)).items[0]?.deepLink).toBe(
      'beerry://customer/qrs?filter=HISTORY',
    );
  });

  it('checks order ownership and assigns the event destination appropriate to each role', async () => {
    const context = await fixture();
    const [buyer, transferred, reviewer] = await Promise.all([
      user(),
      user(),
      user(UserRole.SUPER_ADMIN),
    ]);
    const paid = await order(context, buyer.id, 'PAID', new Date());
    await notice(buyer.id, { eventId: context.event.id, orderId: paid.id });
    await notice(transferred.id, { eventId: context.event.id, orderId: paid.id });
    await notice(context.admin.id, { eventId: context.event.id });
    await notice(reviewer.id, { eventId: context.event.id });

    await service.dispatchPending();
    expect((await service.list(buyer.id)).items[0]?.deepLink).toBe(
      `beerry://customer/operations/orders/${paid.id}`,
    );
    expect((await service.list(transferred.id)).items[0]?.deepLink).toBe(
      'beerry://customer/qrs?filter=HISTORY',
    );
    expect((await service.list(context.admin.id)).items[0]?.deepLink).toBe(
      `beerry://admin/club/events/${context.event.id}`,
    );
    expect((await service.list(reviewer.id)).items[0]?.deepLink).toBe(
      'beerry://admin/event-resolutions',
    );
  });

  it('enqueues and sends only once when dispatchers run concurrently and repeatedly', async () => {
    const recipient = await user();
    await service.registerDevice(recipient.id, `notification-sql-${randomUUID()}`, 'android');
    const notification = await notice(recipient.id);
    const otherDispatcher = new NotificationService(prisma, { send: jest.fn() }, { send });
    const thirdDispatcher = new NotificationService(prisma, { send: jest.fn() }, { send });
    await Promise.all([
      service.dispatchPending(),
      otherDispatcher.dispatchPending(),
      thirdDispatcher.dispatchPending(),
    ]);
    // Database and application clocks need not share the same millisecond.
    await prisma.notificationDelivery.updateMany({
      where: { notificationId: notification.id, channel: 'PUSH', status: 'PENDING' },
      data: { nextAttemptAt: new Date(0) },
    });
    await Promise.all([
      service.dispatchPending(),
      otherDispatcher.dispatchPending(),
      thirdDispatcher.dispatchPending(),
    ]);
    await otherDispatcher.dispatchPending();

    const deliveries = await prisma.notificationDelivery.findMany({
      where: { notificationId: notification.id },
    });
    expect(deliveries).toHaveLength(2);
    expect(deliveries.find((item) => item.channel === 'IN_APP')?.status).toBe('SENT');
    expect(deliveries.find((item) => item.channel === 'PUSH')).toMatchObject({
      status: 'SENT',
      attempts: 1,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: notification.id, userId: recipient.id }),
    );
  });

  it('honors event channel preferences and suppresses stale pushes without hiding the inbox', async () => {
    const [pushOnly, disabled, stale, inAppOnly] = await Promise.all([
      user(),
      user(),
      user(),
      user(),
    ]);
    await Promise.all([
      service.updatePreference(pushOnly.id, {
        category: 'EVENT',
        inAppEnabled: false,
        pushEnabled: true,
      }),
      service.updatePreference(disabled.id, {
        category: 'EVENT',
        inAppEnabled: false,
        pushEnabled: false,
      }),
      service.updatePreference(inAppOnly.id, {
        category: 'EVENT',
        inAppEnabled: true,
        pushEnabled: false,
      }),
    ]);
    await service.registerDevice(pushOnly.id, `event-push-only-${randomUUID()}`, 'android');
    const notifications = await Promise.all([
      notice(pushOnly.id),
      notice(disabled.id),
      notice(stale.id, {}, new Date(Date.now() - 25 * 3_600_000)),
      notice(inAppOnly.id),
    ]);
    await service.dispatchPending();
    await prisma.notificationDelivery.updateMany({
      where: {
        notificationId: { in: notifications.map((item) => item.id) },
        channel: 'PUSH',
        status: 'PENDING',
      },
      data: { nextAttemptAt: new Date(0) },
    });
    await service.dispatchPending();
    for (const [index, statuses] of [
      ['SKIPPED', 'SENT'],
      ['SKIPPED', 'SKIPPED'],
      ['SENT', 'SKIPPED'],
      ['SENT', 'SKIPPED'],
    ].entries()) {
      const deliveries = await prisma.notificationDelivery.findMany({
        where: { notificationId: notifications[index]!.id },
      });
      expect(deliveries.find((item) => item.channel === 'IN_APP')?.status).toBe(statuses[0]);
      expect(deliveries.find((item) => item.channel === 'PUSH')?.status).toBe(statuses[1]);
    }
    expect(send).toHaveBeenCalledTimes(1);
    expect((await service.list(pushOnly.id)).items).toHaveLength(0);
    expect((await service.list(disabled.id)).items).toHaveLength(0);
    expect((await service.list(stale.id)).unreadCount).toBe(1);
    expect(await service.markAllRead(pushOnly.id)).toEqual({ updated: 0 });
    expect(await service.markAllRead(stale.id)).toEqual({ updated: 1 });
    expect((await service.list(stale.id)).unreadCount).toBe(0);
  });
});
