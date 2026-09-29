/// <reference types="jest" />
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationService } from '@modules/notification/application/notification.service';

describe('Notification center policies', () => {
  const create = () => {
    const prisma = {
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
        category: 'PAYMENT',
        version: 1,
        titleTemplate: 'Pago',
        bodyTemplate: 'Estado',
        deepLinkTemplate: input.create.deepLinkTemplate,
      });
      await expect(
        service.notifyFromTemplate('owner', key, { orderId: 'order' }, { orderId: 'order' }),
      ).resolves.toMatchObject({ deepLink: renderedLink, data: { orderId: 'order' } });
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
