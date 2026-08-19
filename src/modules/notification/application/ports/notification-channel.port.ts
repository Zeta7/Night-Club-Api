export const PUSH_NOTIFICATION_CHANNEL = Symbol('PUSH_NOTIFICATION_CHANNEL');

export type NotificationChannelMessage = {
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  deepLink?: string | null;
  data?: Record<string, unknown>;
  deviceTokens: string[];
};

export type NotificationDeliveryResult = {
  provider: string;
  providerMessageId?: string;
  skipped?: boolean;
  metadata?: Record<string, unknown>;
};

export interface NotificationChannel {
  send(message: NotificationChannelMessage): Promise<NotificationDeliveryResult>;
}
