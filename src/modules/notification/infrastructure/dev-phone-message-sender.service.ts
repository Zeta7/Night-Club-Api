import { Injectable, Logger } from '@nestjs/common';
import {
  PhoneMessageSender,
  SendPhoneMessageInput,
} from '../application/ports/phone-message-sender.port';

@Injectable()
export class DevPhoneMessageSender implements PhoneMessageSender {
  private readonly logger = new Logger(DevPhoneMessageSender.name);

  async send(input: SendPhoneMessageInput): Promise<void> {
    this.logger.log(`Mensaje para ${input.phoneCountryCode}${input.phoneNumber}: ${input.message}`);
  }
}
