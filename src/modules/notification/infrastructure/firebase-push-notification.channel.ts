import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
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
        ? cert(JSON.parse(rawServiceAccount) as Parameters<typeof cert>[0])
        : applicationDefault(),
    });
  }

  async send(message: NotificationChannelMessage): Promise<NotificationDeliveryResult> {
    if (message.deviceTokens.length === 0) {
      return { provider: 'firebase', skipped: true, metadata: { reason: 'NO_DEVICE_TOKEN' } };
    }
    const response = await getMessaging().sendEach(
      message.deviceTokens.map((token) => ({
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
          priority: 'high' as const,
          notification: { channelId: 'beerry_notifications', sound: 'default' },
        },
        apns: { payload: { aps: { sound: 'default', contentAvailable: true } } },
      })),
    );
    const invalidTokens = response.responses.flatMap((item, index) => {
      const code = item.error?.code;
      return code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
        ? [message.deviceTokens[index]]
        : [];
    });
    if (response.successCount === 0 && response.failureCount > 0 && invalidTokens.length === 0) {
      throw response.responses.find((item) => item.error)?.error ?? new Error('FCM delivery failed');
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
