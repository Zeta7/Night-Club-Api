import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './application/notification.service';
import { PHONE_MESSAGE_SENDER } from './application/ports/phone-message-sender.port';
import { DevPhoneMessageSender } from './infrastructure/dev-phone-message-sender.service';
import { TwilioPhoneMessageSender } from './infrastructure/twilio-phone-message-sender.service';

@Module({
  providers: [
    NotificationService,
    DevPhoneMessageSender,
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
