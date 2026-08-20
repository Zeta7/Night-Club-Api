/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { SimulatedPushNotificationChannel } from '@modules/notification/infrastructure/simulated-push-notification.channel';
import { NotificationService } from '@modules/notification/application/notification.service';

describe('Notification center integration', () => {
  const prisma = new PrismaService(new ConfigService());
  const service = new NotificationService(
    prisma,
    { send: jest.fn(async () => undefined) },
    new SimulatedPushNotificationChannel(),
  );
  const userIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
    await service.onModuleInit();
  });

  afterAll(async () => {
    service.onModuleDestroy();
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function createUser(label: string) {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
    const user = await prisma.user.create({
      data: {
        phoneCountryCode: '+51',
        phoneNumber: suffix,
        passwordHash: 'integration-test',
        fullName: label,
        status: 'ACTIVE',
      },
    });
    userIds.push(user.id);
    return user;
  }

  it('creates an unread in-app notification and sends simulated push', async () => {
    const user = await createUser('Notification recipient');
    await service.registerDevice(user.id, `device-${randomUUID()}`, 'android');
    const notification = await service.notifyFromTemplate(
      user.id,
      'PAYMENT_APPROVED',
      { amount: '25.00', orderId: 'order-test' },
      { orderId: 'order-test' },
    );
    expect(notification).not.toBeNull();

    const inbox = await service.list(user.id, false);
    expect(inbox.unreadCount).toBe(1);
    expect(inbox.items[0]).toMatchObject({
      title: 'Pago aprobado',
      deepLink: '/orders/order-test',
    });

    await service.dispatchPending();
    const delivery = await prisma.notificationDelivery.findUniqueOrThrow({
      where: { notificationId_channel: { notificationId: notification!.id, channel: 'PUSH' } },
    });
    expect(delivery.status).toBe('SENT');
    expect(delivery.provider).toBe('simulated');

    await service.markRead(user.id, notification!.id);
    expect((await service.list(user.id, false)).unreadCount).toBe(0);
  });

  it('honors disabled in-app and push preferences', async () => {
    const user = await createUser('Preferences');
    await service.updatePreference(user.id, {
      category: 'PAYMENT',
      inAppEnabled: false,
      pushEnabled: false,
    });

    const notification = await service.notifyFromTemplate(user.id, 'PAYMENT_REJECTED', {
      orderId: 'order-disabled',
    });
    expect(notification).toBeNull();
    expect((await service.list(user.id, false)).items).toHaveLength(0);
  });

  it('does not allow another user to mark a notification as read', async () => {
    const owner = await createUser('Owner');
    const other = await createUser('Other');
    const notification = await service.notifyFromTemplate(owner.id, 'QR_AVAILABLE', {
      orderId: 'order-owner',
    });

    await expect(service.markRead(other.id, notification!.id)).rejects.toBeDefined();
    expect((await service.list(owner.id, false)).unreadCount).toBe(1);
  });
});
