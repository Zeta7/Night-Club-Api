import { NotificationAudience } from '@prisma/client';
import { JsonObject } from '../../../../shared/domain/json';
export const MAX_PUSH_BATCH_SIZE = 500;
export const PUSH_NOTIFICATION_CHANNEL = Symbol('PUSH_NOTIFICATION_CHANNEL');

export type NotificationChannelMessage = {
  notificationId: string;
  userId: string;
  audience: NotificationAudience;
  title: string;
  body: string;
  deepLink?: string | null;
  data?: JsonObject;
  deviceTokens: string[];
};

export type NotificationDeliveryResult = {
  provider: string;
  providerMessageId?: string;
  sentTokens: string[];
  invalidTokens: string[];
  retryTokens: string[];
  errorMessage?: string;
  metadata?: JsonObject;
};

export interface NotificationChannel {
  send(message: NotificationChannelMessage): Promise<NotificationDeliveryResult>;
}
