import { forwardRef, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './application/notification.service';
import { PHONE_MESSAGE_SENDER } from './application/ports/phone-message-sender.port';
import { DevPhoneMessageSender } from './infrastructure/dev-phone-message-sender.service';
import { TwilioPhoneMessageSender } from './infrastructure/twilio-phone-message-sender.service';
import { NotificationController } from './presentation/notification.controller';
import { IdentityModule } from '../identity/identity.module';
import { PUSH_NOTIFICATION_CHANNEL } from './application/ports/notification-channel.port';
import { SimulatedPushNotificationChannel } from './infrastructure/simulated-push-notification.channel';
import { FirebasePushNotificationChannel } from './infrastructure/firebase-push-notification.channel';

@Module({
  imports: [forwardRef(() => IdentityModule)],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    DevPhoneMessageSender,
    SimulatedPushNotificationChannel,
    {
      provide: PUSH_NOTIFICATION_CHANNEL,
      inject: [ConfigService, SimulatedPushNotificationChannel],
      useFactory: (config: ConfigService, simulated: SimulatedPushNotificationChannel) =>
        config.get<string>('PUSH_NOTIFICATION_PROVIDER', 'simulated').toLowerCase() === 'firebase'
          ? new FirebasePushNotificationChannel(config)
          : simulated,
    },
    {
      provide: PHONE_MESSAGE_SENDER,
      inject: [ConfigService, DevPhoneMessageSender],
      useFactory: (config: ConfigService, devSender: DevPhoneMessageSender) => {
        const logger = new Logger('NotificationModule');
        const provider = config.get<string>('PHONE_MESSAGE_PROVIDER', 'dev').toLowerCase();

        if (provider === 'twilio') {
          logger.log('Proveedor de mensajes telefonicos activo: twilio');

          return new TwilioPhoneMessageSender(config);
        }

        if (provider !== 'dev') {
          logger.warn(`Proveedor de mensajes telefonicos no soportado: ${provider}. Se usara dev.`);
        } else {
          logger.warn('Proveedor de mensajes telefonicos activo: dev. No se enviaran SMS reales.');
        }

        return devSender;
      },
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
