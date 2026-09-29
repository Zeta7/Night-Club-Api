/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { NotificationService } from '@modules/notification/application/notification.service';
import {
  NotificationChannelMessage,
  NotificationDeliveryResult,
} from '@modules/notification/application/ports/notification-channel.port';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

// The caller must provide an isolated DATABASE_URL. No .env or external push service is loaded.
describe('Durable push delivery', () => {
  const prisma = new PrismaService(new ConfigService());
  const userIds: string[] = [];
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    jest.useRealTimers();
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });
  afterEach(() => jest.useRealTimers());

  const delivered = (message: NotificationChannelMessage): NotificationDeliveryResult => ({
    provider: 'test',
    sentTokens: message.deviceTokens,
    invalidTokens: [],
    retryTokens: [],
  });
  const service = (
    send: (message: NotificationChannelMessage) => Promise<NotificationDeliveryResult>,
  ) => new NotificationService(prisma, { send: jest.fn() }, { send });

  async function createUser() {
    const user = await prisma.user.create({
      data: {
        phoneCountryCode: '+51',
        phoneNumber: randomUUID().replace(/-/g, '').slice(0, 12),
        passwordHash: 'test',
        fullName: 'Delivery test',
        status: 'ACTIVE',
      },
    });
    userIds.push(user.id);
    return user;
  }

  async function fixture(deviceCount: number) {
    const user = await createUser();
    const tokens = Array.from({ length: deviceCount }, (_, index) => `${user.id}-device-${index}`);
    await prisma.deviceToken.createMany({
      data: tokens.map((token) => ({ userId: user.id, token, platform: 'android' })),
    });
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        category: 'SYSTEM',
        title: 'Notice',
        body: 'Body',
        deliveries: {
          create: {
            channel: 'PUSH',
            provider: 'test',
            status: 'PENDING',
            nextAttemptAt: new Date(0),
          },
        },
      },
      include: { deliveries: true },
    });
    const delivery = notification.deliveries[0];
    if (!delivery) throw new Error('Missing delivery fixture');
    const read = () =>
      prisma.notificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    const retryNow = () =>
      prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { nextAttemptAt: new Date(0) },
      });
    return { user, tokens, delivery, read, retryNow };
  }

  it('splits 1001 devices and resumes only the failed device after restarting the service', async () => {
    const { user, tokens, read, retryNow } = await fixture(1001);
    const retry = tokens[0];
    const invalid = tokens[1];
    if (!retry || !invalid) throw new Error('Missing device fixture');
    const first = jest.fn(
      async (message: NotificationChannelMessage): Promise<NotificationDeliveryResult> => ({
        provider: 'test',
        sentTokens: message.deviceTokens.filter((token) => token !== retry && token !== invalid),
        retryTokens: message.deviceTokens.filter((token) => token === retry),
        invalidTokens: message.deviceTokens.filter((token) => token === invalid),
        errorMessage: 'Transient failure',
      }),
    );
    await service(first).dispatchPending();
    expect(first.mock.calls.map(([message]) => message.deviceTokens.length)).toEqual([500, 500, 1]);
    expect(await read()).toMatchObject({
      status: 'PENDING',
      attempts: 1,
      providerData: { pendingTokens: [retry], sentCount: 999 },
    });
    expect(await prisma.deviceToken.findUniqueOrThrow({ where: { token: invalid } })).toMatchObject(
      { enabled: false },
    );
    await prisma.deviceToken.create({
      data: { userId: user.id, token: `${user.id}-new-device`, platform: 'android' },
    });
    await retryNow();
    const second = jest.fn(async (message: NotificationChannelMessage) => delivered(message));
    await service(second).dispatchPending();
    expect(second.mock.calls.map(([message]) => message.deviceTokens)).toEqual([[retry]]);
    expect(await read()).toMatchObject({
      status: 'SENT',
      attempts: 2,
      providerData: { pendingTokens: [], sentCount: 1000 },
    });
  });

  it('preserves the completed batch when the next batch throws', async () => {
    const { read, retryNow } = await fixture(1001);
    const first = jest
      .fn(async (message: NotificationChannelMessage) => delivered(message))
      .mockImplementationOnce(async (message) => delivered(message))
      .mockRejectedValueOnce(new Error('Network failure'));
    await service(first).dispatchPending();
    const succeeded = first.mock.calls[0]?.[0].deviceTokens;
    if (!succeeded) throw new Error('No first batch');
    expect(await read()).toMatchObject({ status: 'PENDING', providerData: { sentCount: 500 } });
    await retryNow();
    const second = jest.fn(async (message: NotificationChannelMessage) => delivered(message));
    await service(second).dispatchPending();
    const retried = second.mock.calls.flatMap(([message]) => message.deviceTokens);
    expect(retried).toHaveLength(501);
    expect(retried.some((token) => succeeded.includes(token))).toBe(false);
    expect(await read()).toMatchObject({
      status: 'SENT',
      providerData: { sentCount: 1001, pendingTokens: [] },
    });
  });

  it('does not send a pending token after it belongs to another user', async () => {
    const { tokens, read, retryNow } = await fixture(2);
    const retry = tokens[0];
    if (!retry) throw new Error('Missing device');
    const first = jest.fn(
      async (message: NotificationChannelMessage): Promise<NotificationDeliveryResult> => ({
        provider: 'test',
        sentTokens: message.deviceTokens.filter((token) => token !== retry),
        retryTokens: [retry],
        invalidTokens: [],
      }),
    );
    await service(first).dispatchPending();
    const other = await createUser();
    await prisma.deviceToken.update({ where: { token: retry }, data: { userId: other.id } });
    await retryNow();
    const second = jest.fn(async (message: NotificationChannelMessage) => delivered(message));
    await service(second).dispatchPending();
    expect(second).not.toHaveBeenCalled();
    expect(await read()).toMatchObject({
      status: 'SENT',
      providerData: { pendingTokens: [], sentCount: 1 },
    });
  });

  it('keeps a slow send claimed across local ticks and another service instance', async () => {
    const { read } = await fixture(1);
    let release: ((result: NotificationDeliveryResult) => void) | undefined;
    let accepted: NotificationChannelMessage | undefined;
    const first = jest.fn((message: NotificationChannelMessage) => {
      accepted = message;
      return new Promise<NotificationDeliveryResult>((resolve) => {
        release = resolve;
      });
    });
    const dispatcher = service(first);
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const active = dispatcher.dispatchPending();
    // Wait for the database claim and channel call, without depending on wall-clock duration.
    while (!accepted) await new Promise<void>((resolve) => setImmediate(resolve));
    try {
      await jest.advanceTimersByTimeAsync(61_000);
      expect(await dispatcher.dispatchPending()).toEqual({ processed: 0 });
      const second = jest.fn(async (message: NotificationChannelMessage) => delivered(message));
      await service(second).dispatchPending();
      expect(second).not.toHaveBeenCalled();
    } finally {
      if (!release || !accepted) throw new Error('Missing pending channel call');
      release(delivered(accepted));
      await active;
    }
    expect(first).toHaveBeenCalledTimes(1);
    expect(await read()).toMatchObject({ status: 'SENT' });
  });

  it('marks a delivery skipped when every token is invalid and disables them', async () => {
    const { tokens, read } = await fixture(2);
    const send = jest.fn(
      async (message: NotificationChannelMessage): Promise<NotificationDeliveryResult> => ({
        provider: 'test',
        sentTokens: [],
        retryTokens: [],
        invalidTokens: message.deviceTokens,
      }),
    );
    await service(send).dispatchPending();
    expect(await read()).toMatchObject({
      status: 'SKIPPED',
      sentAt: null,
      providerData: { sentCount: 0, pendingTokens: [] },
    });
    expect(
      await prisma.deviceToken.count({ where: { token: { in: tokens }, enabled: true } }),
    ).toBe(0);
  });

  it('exhausts only the pending devices while retaining previous successes', async () => {
    const { tokens, read, retryNow } = await fixture(2);
    const retry = tokens[0];
    if (!retry) throw new Error('Missing retry device');
    const send = jest.fn(
      async (message: NotificationChannelMessage): Promise<NotificationDeliveryResult> => ({
        provider: 'test',
        sentTokens: message.deviceTokens.filter((token) => token !== retry),
        retryTokens: [retry],
        invalidTokens: [],
        errorMessage: 'Provider unavailable',
      }),
    );
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await retryNow();
      await service(send).dispatchPending();
    }
    expect(send.mock.calls).toHaveLength(5);
    expect(send.mock.calls.slice(1).map(([message]) => message.deviceTokens)).toEqual([
      [retry],
      [retry],
      [retry],
      [retry],
    ]);
    expect(await read()).toMatchObject({
      status: 'FAILED',
      attempts: 5,
      providerData: { sentCount: 1, pendingTokens: [retry] },
    });
    await retryNow();
    await service(send).dispatchPending();
    expect(send.mock.calls).toHaveLength(5);
  });
});
