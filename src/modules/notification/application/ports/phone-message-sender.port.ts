export const PHONE_MESSAGE_SENDER = Symbol('PHONE_MESSAGE_SENDER');

export type SendPhoneMessageInput = {
  phoneCountryCode: string;
  phoneNumber: string;
  message: string;
};

export interface PhoneMessageSender {
  send(input: SendPhoneMessageInput): Promise<void>;
}
