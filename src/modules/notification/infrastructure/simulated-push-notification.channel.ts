import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  NotificationChannel,
  NotificationChannelMessage,
  NotificationDeliveryResult,
} from '../application/ports/notification-channel.port';

@Injectable()
export class SimulatedPushNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger(SimulatedPushNotificationChannel.name);

  async send(message: NotificationChannelMessage): Promise<NotificationDeliveryResult> {
    if (message.deviceTokens.length === 0) {
      return { provider: 'simulated', skipped: true, metadata: { reason: 'NO_DEVICE_TOKEN' } };
    }
    const providerMessageId = `sim_push_${randomUUID()}`;
    this.logger.log(
      `[${providerMessageId}] ${message.userId}: ${message.title} (${message.deviceTokens.length} dispositivo(s))`,
    );
    return {
      provider: 'simulated',
      providerMessageId,
      metadata: { deviceCount: message.deviceTokens.length },
    };
  }
}
