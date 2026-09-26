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
      title: 'Title',
      body: 'Body',
      deviceTokens: ['valid', 'invalid'],
    });
    expect(result.metadata?.invalidTokens).toEqual(['invalid']);
  });
});
