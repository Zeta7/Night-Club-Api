/// <reference types="jest" />
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationService } from '@modules/notification/application/notification.service';

describe('Notification center policies', () => {
  const create = () => {
    const prisma = {
      user: { findUnique: jest.fn() },
      notificationTemplate: {
        upsert: jest.fn(async (_input: Prisma.NotificationTemplateUpsertArgs) => ({})),
        findFirst: jest.fn(),
      },
      notificationPreference: { findUnique: jest.fn(async () => null) },
      notification: {
        create: jest.fn(async (input) => input.data),
        updateMany: jest.fn(async () => ({ count: 2 })),
      },
    };
    const service = new NotificationService(
      prisma as never,
      { send: jest.fn() },
      { send: jest.fn() },
    );
    return { prisma, service };
  };

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('marks only visible in-app notifications as read in bulk', async () => {
    const { prisma, service } = create();
    await expect(service.markAllRead('owner')).resolves.toEqual({ updated: 2 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'owner',
        readAt: null,
        deliveries: { some: { channel: 'IN_APP', status: 'SENT' } },
      },
      data: { readAt: expect.any(Date) },
    });
  });

  it.each([
    ['PAYMENT_REJECTED', '/orders/{orderId}', '/orders/order'],
    ['PAYMENT_EXPIRED', '/orders/{orderId}', '/orders/order'],
    ['QR_AVAILABLE', '/customer/qrs?orderId={orderId}', '/customer/qrs?orderId=order'],
    ['ADMIN_NEW_SALE', '/admin/sales/{orderId}?clubId={clubId}', '/admin/sales/order?clubId=club'],
  ])(
    'points %s at the resource for the affected order',
    async (key, templateLink, renderedLink) => {
      const { prisma, service } = create();
      jest.spyOn(service, 'dispatchPending').mockResolvedValue({ processed: 0 });
      await service.onModuleInit();
      service.onModuleDestroy();
      const input = prisma.notificationTemplate.upsert.mock.calls.find(
        ([input]) => input.create.key === key,
      )?.[0];
      if (!input) throw new Error('Missing payment template');
      expect(input).toMatchObject({
        create: { deepLinkTemplate: templateLink },
        update: { deepLinkTemplate: templateLink },
      });
      prisma.notificationTemplate.findFirst.mockResolvedValue({
        key,
        category: input.create.category,
        audience: input.create.audience,
        version: 1,
        titleTemplate: 'Pago',
        bodyTemplate: 'Estado',
        deepLinkTemplate: input.create.deepLinkTemplate,
      });
      await expect(
        service.notifyFromTemplate(
          'owner',
          key,
          { orderId: 'order', clubId: 'club' },
          { orderId: 'order' },
        ),
      ).resolves.toMatchObject({
        deepLink: renderedLink,
        data: { orderId: 'order' },
        audience: key === 'ADMIN_NEW_SALE' ? 'OPERATIONS' : 'CUSTOMER',
      });
    },
  );

  it.each(['BUSINESS_ACCESS_APPROVED', 'BUSINESS_ACCESS_REJECTED'])(
    'persists %s in the recipient available experience without moving worker purchases',
    async (key) => {
      const { prisma, service } = create();
      prisma.notificationTemplate.findFirst.mockResolvedValue({
        key,
        category: 'SYSTEM',
        audience: 'CUSTOMER',
        version: 1,
        titleTemplate: 'Solicitud',
        bodyTemplate: 'Estado',
        deepLinkTemplate: '/profile/business-access',
      });
      for (const role of ['CUSTOMER', 'WORKER', 'ADMIN', 'SUPER_ADMIN']) {
        prisma.user.findUnique.mockResolvedValue({ role });
        expect(await service.notifyFromTemplate('recipient', key, {})).toMatchObject({
          audience: role === 'ADMIN' || role === 'SUPER_ADMIN' ? 'OPERATIONS' : 'CUSTOMER',
          deepLink:
            role === 'ADMIN' || role === 'SUPER_ADMIN'
              ? '/admin/profile/business-access'
              : '/profile/business-access',
        });
      }
    },
  );

  it('contains a dispatcher failure and continues the scheduled delivery loop', async () => {
    jest.useFakeTimers();
    const { service } = create();
    const failure = new Error('database unavailable');
    const dispatch = jest
      .spyOn(service, 'dispatchPending')
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({ processed: 0 });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await service.onModuleInit();
    await Promise.resolve();
    expect(log).toHaveBeenCalledWith(
      'No se pudieron despachar las notificaciones pendientes.',
      failure,
    );
    await jest.advanceTimersByTimeAsync(5_000);
    expect(dispatch).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
  });
});
