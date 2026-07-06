import { Inject, Injectable } from '@nestjs/common';
import { PHONE_MESSAGE_SENDER, PhoneMessageSender } from './ports/phone-message-sender.port';

type SendPhoneVerificationCodeInput = {
  phoneCountryCode: string;
  phoneNumber: string;
  code: string;
  expirationMinutes: number;
};

@Injectable()
export class NotificationService {
  constructor(
    @Inject(PHONE_MESSAGE_SENDER)
    private readonly phoneMessageSender: PhoneMessageSender,
  ) {}

  sendPhoneVerificationCode(input: SendPhoneVerificationCodeInput): Promise<void> {
    return this.phoneMessageSender.send({
      phoneCountryCode: input.phoneCountryCode,
      phoneNumber: input.phoneNumber,
      message: `Tu codigo de confirmacion de NightClub Platform es ${input.code}. Expira en ${input.expirationMinutes} minutos.`,
    });
  }

  sendPasswordRecoveryCode(input: SendPhoneVerificationCodeInput): Promise<void> {
    return this.phoneMessageSender.send({
      phoneCountryCode: input.phoneCountryCode,
      phoneNumber: input.phoneNumber,
      message: `Tu codigo para recuperar tu contrasena en NightClub Platform es ${input.code}. Expira en ${input.expirationMinutes} minutos.`,
    });
  }
}
