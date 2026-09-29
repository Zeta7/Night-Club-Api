/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { FirebasePushNotificationChannel } from '@modules/notification/infrastructure/firebase-push-notification.channel';

jest.mock('firebase-admin/app', () => ({
  getApps: () => [],
  initializeApp: jest.fn(),
  cert: jest.fn(),
  applicationDefault: jest.fn(),
}));
jest.mock('firebase-admin/messaging', () => {
  const messaging = { sendEach: jest.fn() };
  return { getMessaging: () => messaging };
});

describe('Firebase notification boundary', () => {
  beforeEach(() => jest.clearAllMocks());
  const configure = (account: unknown) =>
    new FirebasePushNotificationChannel(
      new ConfigService({
        FIREBASE_PROJECT_ID: 'beerry-test',
        FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(account),
      }),
    );

  it.each([
    { project_id: 'beerry-test', client_email: 'test@example.com', private_key: 'test-key' },
    { projectId: 'beerry-test', clientEmail: 'test@example.com', privateKey: 'test-key' },
  ])('maps validated service account fields into the SDK', (account) => {
    configure(account);
    expect(cert).toHaveBeenCalledWith({
      projectId: 'beerry-test',
      clientEmail: 'test@example.com',
      privateKey: 'test-key',
    });
    expect(initializeApp).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    [],
    { project_id: 5 },
    { project_id: 'beerry-test', client_email: 'test@example.com' },
  ])('rejects malformed service accounts before SDK initialization: %p', (account) => {
    expect(() => configure(account)).toThrow('FIREBASE_SERVICE_ACCOUNT_JSON');
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('returns only invalid tokens that belong to the submitted batch', async () => {
    const channel = configure({
      project_id: 'beerry-test',
      client_email: 'test@example.com',
      private_key: 'test-key',
    });
    const error = {
      code: 'messaging/invalid-registration-token',
      name: 'FirebaseError',
      message: 'Invalid token',
      hasCode: (code: string) => code === 'messaging/invalid-registration-token',
      toJSON: () => ({}),
    };
    jest.mocked(getMessaging().sendEach).mockResolvedValue({
      successCount: 1,
      failureCount: 2,
      responses: [
        { success: true, messageId: 'sent' },
        { success: false, error },
        { success: false, error },
      ],
    });
    const result = await channel.send({
      notificationId: 'notification',
      userId: 'user',
      audience: 'CUSTOMER' as const,
      title: 'Title',
      body: 'Body',
      deviceTokens: ['valid', 'invalid'],
    });
    expect(result.invalidTokens).toEqual(['invalid']);
  });

  it('keeps navigation identifiers authoritative when metadata repeats their names', async () => {
    const channel = configure({
      project_id: 'beerry-test',
      client_email: 'test@example.com',
      private_key: 'key',
    });
    jest
      .mocked(getMessaging().sendEach)
      .mockResolvedValue({ successCount: 1, failureCount: 0, responses: [{ success: true }] });
    await channel.send({
      notificationId: 'notice',
      userId: 'user',
      audience: 'CUSTOMER' as const,
      title: 'Title',
      body: 'Body',
      deepLink: '/orders/order',
      data: {
        notificationId: 'other',
        deepLink: '/cart',
        audience: 'OPERATIONS',
        orderId: 'order',
      },
      deviceTokens: ['token'],
    });
    expect(getMessaging().sendEach).toHaveBeenCalledWith([
      expect.objectContaining({
        data: {
          notificationId: 'notice',
          deepLink: '/orders/order',
          audience: 'CUSTOMER' as const,
          orderId: 'order',
        },
      }),
    ]);
  });

  it('skips a batch when every submitted token is invalid', async () => {
    const channel = configure({
      project_id: 'beerry-test',
      client_email: 'test@example.com',
      private_key: 'key',
    });
    jest.mocked(getMessaging().sendEach).mockResolvedValue({
      successCount: 0,
      failureCount: 1,
      responses: [
        { success: false, error: { code: 'messaging/invalid-registration-token' } as never },
      ],
    });
    await expect(
      channel.send({
        notificationId: 'notice',
        userId: 'user',
        audience: 'CUSTOMER' as const,
        title: 'Title',
        body: 'Body',
        deviceTokens: ['invalid'],
      }),
    ).resolves.toMatchObject({ sentTokens: [], invalidTokens: ['invalid'], retryTokens: [] });
  });

  it('retries a failed batch even when another token was invalid', async () => {
    const channel = configure({
      project_id: 'beerry-test',
      client_email: 'test@example.com',
      private_key: 'key',
    });
    const unavailable = new Error('FCM unavailable');
    Object.assign(unavailable, { code: 'messaging/server-unavailable' });
    jest.mocked(getMessaging().sendEach).mockResolvedValue({
      successCount: 0,
      failureCount: 2,
      responses: [
        { success: false, error: { code: 'messaging/invalid-registration-token' } as never },
        { success: false, error: unavailable as never },
      ],
    });
    await expect(
      channel.send({
        notificationId: 'notice',
        userId: 'user',
        audience: 'CUSTOMER' as const,
        title: 'Title',
        body: 'Body',
        deviceTokens: ['invalid', 'retry'],
      }),
    ).resolves.toMatchObject({
      sentTokens: [],
      invalidTokens: ['invalid'],
      retryTokens: ['retry'],
      errorMessage: 'FCM unavailable',
    });
  });

  it('keeps successes out of retry tokens after a partial failure', async () => {
    const channel = configure({
      project_id: 'beerry-test',
      client_email: 'test@example.com',
      private_key: 'key',
    });
    jest.mocked(getMessaging().sendEach).mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true, messageId: 'accepted' },
        {
          success: false,
          error: { code: 'messaging/server-unavailable', message: 'Later' } as never,
        },
      ],
    });
    await expect(
      channel.send({
        notificationId: 'notice',
        userId: 'user',
        audience: 'CUSTOMER' as const,
        title: 'Title',
        body: 'Body',
        deviceTokens: ['success', 'retry'],
      }),
    ).resolves.toMatchObject({
      sentTokens: ['success'],
      retryTokens: ['retry'],
      invalidTokens: [],
    });
  });

  it('accepts 500 devices and rejects a batch beyond the provider limit before sending', async () => {
    const channel = configure({
      project_id: 'beerry-test',
      client_email: 'test@example.com',
      private_key: 'key',
    });
    const tokens = Array.from({ length: 500 }, (_, index) => `token-${index}`);
    jest.mocked(getMessaging().sendEach).mockResolvedValue({
      successCount: 500,
      failureCount: 0,
      responses: tokens.map(() => ({ success: true })),
    });
    const message = {
      notificationId: 'notice',
      userId: 'user',
      audience: 'CUSTOMER' as const,
      title: 'Title',
      body: 'Body',
      deviceTokens: tokens,
    };
    expect((await channel.send(message)).sentTokens).toHaveLength(500);
    await expect(channel.send({ ...message, deviceTokens: [...tokens, 'extra'] })).rejects.toThrow(
      '500',
    );
    expect(getMessaging().sendEach).toHaveBeenCalledTimes(1);
  });

  it('retries a submitted device when its response is absent', async () => {
    const channel = configure({
      project_id: 'beerry-test',
      client_email: 'test@example.com',
      private_key: 'key',
    });
    jest
      .mocked(getMessaging().sendEach)
      .mockResolvedValue({ successCount: 1, failureCount: 0, responses: [{ success: true }] });
    await expect(
      channel.send({
        notificationId: 'notice',
        userId: 'user',
        audience: 'CUSTOMER' as const,
        title: 'Title',
        body: 'Body',
        deviceTokens: ['success', 'unknown'],
      }),
    ).resolves.toMatchObject({ sentTokens: ['success'], retryTokens: ['unknown'] });
  });
});
