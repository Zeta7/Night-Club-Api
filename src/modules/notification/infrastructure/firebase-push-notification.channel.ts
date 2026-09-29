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
  MAX_PUSH_BATCH_SIZE,
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
    if (message.deviceTokens.length > MAX_PUSH_BATCH_SIZE) {
      throw new RangeError('El lote push excede 500 dispositivos.');
    }
    if (message.deviceTokens.length === 0) {
      return {
        provider: 'firebase',
        sentTokens: [],
        invalidTokens: [],
        retryTokens: [],
        metadata: { reason: 'NO_DEVICE_TOKEN' },
      };
    }
    const response = await getMessaging().sendEach(
      message.deviceTokens.map((token): Message => ({
        token,
        notification: { title: message.title, body: message.body },
        data: {
          ...Object.fromEntries(
            Object.entries(message.data ?? {})
              .filter(([key]) => key !== 'notificationId' && key !== 'deepLink')
              .map(([key, value]) => [key, String(value)]),
          ),
          notificationId: message.notificationId,
          ...(message.deepLink ? { deepLink: message.deepLink } : {}),
        },
        android: {
          priority: 'high',
          notification: { channelId: 'beerry_notifications', sound: 'default' },
        },
        apns: { payload: { aps: { sound: 'default', contentAvailable: true } } },
      })),
    );
    const sentTokens: string[] = [];
    const invalidTokens: string[] = [];
    const retryTokens: string[] = [];
    let errorMessage: string | undefined;
    for (const [index, token] of message.deviceTokens.entries()) {
      const item = response.responses[index];
      if (item?.success) sentTokens.push(token);
      else if (
        item?.error?.code === 'messaging/registration-token-not-registered' ||
        item?.error?.code === 'messaging/invalid-registration-token'
      )
        invalidTokens.push(token);
      else {
        retryTokens.push(token);
        errorMessage ??= item?.error?.message ?? 'FCM no confirmó la entrega al dispositivo.';
      }
    }
    return {
      provider: 'firebase',
      providerMessageId: response.responses.find((item) => item.success)?.messageId,
      sentTokens,
      invalidTokens,
      retryTokens,
      errorMessage,
      metadata: {
        successCount: sentTokens.length,
        failureCount: invalidTokens.length + retryTokens.length,
      },
    };
  }
}
