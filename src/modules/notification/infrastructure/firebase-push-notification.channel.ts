import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';
import { isRecord } from '../../../shared/domain/json';
import {
  NotificationChannel,
  NotificationChannelMessage,
  NotificationDeliveryResult,
} from '../application/ports/notification-channel.port';

@Injectable()
export class FirebasePushNotificationChannel implements NotificationChannel {
  constructor(config: ConfigService) {
    if (getApps().length > 0) return;
    const projectId = config.getOrThrow<string>('FIREBASE_PROJECT_ID');
    const rawServiceAccount = config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    initializeApp({
      projectId,
      credential: rawServiceAccount
        ? cert(this.parseServiceAccount(rawServiceAccount))
        : applicationDefault(),
    });
  }

  private parseServiceAccount(raw: string): ServiceAccount {
    const account: unknown = JSON.parse(raw);
    if (!isRecord(account)) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON debe ser un objeto.');
    const projectId = account.projectId ?? account.project_id;
    const clientEmail = account.clientEmail ?? account.client_email;
    const privateKey = account.privateKey ?? account.private_key;
    if (
      typeof projectId !== 'string' ||
      typeof clientEmail !== 'string' ||
      typeof privateKey !== 'string'
    ) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON requiere project_id, client_email y private_key.',
      );
    }
    return { projectId, clientEmail, privateKey };
  }

  async send(message: NotificationChannelMessage): Promise<NotificationDeliveryResult> {
    if (message.deviceTokens.length === 0) {
      return { provider: 'firebase', skipped: true, metadata: { reason: 'NO_DEVICE_TOKEN' } };
    }
    const response = await getMessaging().sendEach(
      message.deviceTokens.map((token): Message => ({
        token,
        notification: { title: message.title, body: message.body },
        data: {
          notificationId: message.notificationId,
          ...(message.deepLink ? { deepLink: message.deepLink } : {}),
          ...Object.fromEntries(
            Object.entries(message.data ?? {}).map(([key, value]) => [key, String(value)]),
          ),
        },
        android: {
          priority: 'high',
          notification: { channelId: 'beerry_notifications', sound: 'default' },
        },
        apns: { payload: { aps: { sound: 'default', contentAvailable: true } } },
      })),
    );
    const invalidTokens = response.responses.flatMap((item, index) => {
      const code = item.error?.code;
      const token = message.deviceTokens[index];
      return token &&
        (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token')
        ? [token]
        : [];
    });
    if (response.successCount === 0 && response.failureCount > 0 && invalidTokens.length === 0) {
      throw (
        response.responses.find((item) => item.error)?.error ?? new Error('FCM delivery failed')
      );
    }
    return {
      provider: 'firebase',
      providerMessageId: response.responses.find((item) => item.success)?.messageId,
      metadata: {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
      },
    };
  }
}
