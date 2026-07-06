import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { Twilio } from 'twilio';
import { serviceUnavailable } from '../../../shared/presentation/api-exception';
import {
  PhoneMessageSender,
  SendPhoneMessageInput,
} from '../application/ports/phone-message-sender.port';

@Injectable()
export class TwilioPhoneMessageSender implements PhoneMessageSender {
  private readonly client: Twilio;
  private readonly from: string;
  private readonly logger = new Logger(TwilioPhoneMessageSender.name);

  constructor(config: ConfigService) {
    const accountSid = config.getOrThrow<string>('TWILIO_ACCOUNT_SID');
    const apiKey = config.getOrThrow<string>('TWILIO_API_KEY');
    const apiSecret = config.getOrThrow<string>('TWILIO_API_SECRET');

    this.from = config.getOrThrow<string>('TWILIO_PHONE_NUMBER');
    this.client = twilio(apiKey, apiSecret, { accountSid });
  }

  async send(input: SendPhoneMessageInput): Promise<void> {
    const to = `${input.phoneCountryCode}${input.phoneNumber}`;

    try {
      const result = await this.client.messages.create({
        body: input.message,
        from: this.from,
        to,
      });

      this.logger.log(`SMS enviado correctamente: ${result.sid}`);
    } catch (error) {
      const twilioError = normalizeTwilioError(error);

      this.logger.error(
        `No se pudo enviar SMS con Twilio. status=${twilioError.status ?? 'N/A'} code=${
          twilioError.code ?? 'N/A'
        } message=${twilioError.message}`,
      );

      throw serviceUnavailable('SMS_SEND_FAILED', 'No pudimos enviar el codigo por SMS.', [
        {
          provider: 'twilio',
          status: twilioError.status,
          code: twilioError.code,
          message: twilioError.message,
          to,
        },
      ]);
    }
  }
}

type TwilioErrorDetails = {
  status?: number;
  code?: number;
  message: string;
};

const normalizeTwilioError = (error: unknown): TwilioErrorDetails => {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      status?: unknown;
      code?: unknown;
      message?: unknown;
    };

    return {
      status: typeof candidate.status === 'number' ? candidate.status : undefined,
      code: typeof candidate.code === 'number' ? candidate.code : undefined,
      message:
        typeof candidate.message === 'string' ? candidate.message : 'Error desconocido de Twilio.',
    };
  }

  return {
    message: 'Error desconocido de Twilio.',
  };
};
