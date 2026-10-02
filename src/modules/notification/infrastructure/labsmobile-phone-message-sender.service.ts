import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { serviceUnavailable } from '../../../shared/presentation/api-exception';
import {
  PhoneMessageSender,
  SendPhoneMessageInput,
} from '../application/ports/phone-message-sender.port';

const LABSMOBILE_SEND_URL = 'https://api.labsmobile.com/json/send';
const REQUEST_TIMEOUT_MS = 10_000;

type LabsMobileResponse = {
  code?: string | number;
  message?: string;
  subid?: string;
};

@Injectable()
export class LabsMobilePhoneMessageSender implements PhoneMessageSender {
  private readonly username: string;
  private readonly apiToken: string;
  private readonly sender: string;
  private readonly logger = new Logger(LabsMobilePhoneMessageSender.name);

  constructor(config: ConfigService) {
    this.username = requiredConfig(config, 'LABSMOBILE_USERNAME');
    this.apiToken = requiredConfig(config, 'LABSMOBILE_API_TOKEN');
    this.sender = (config.get<string>('LABSMOBILE_SENDER') || 'Beerry').trim();

    if (!this.sender || this.sender.length > 11) {
      throw new Error('LABSMOBILE_SENDER debe contener entre 1 y 11 caracteres.');
    }
  }

  async send(input: SendPhoneMessageInput): Promise<void> {
    const to = normalizeMsisdn(input.phoneCountryCode, input.phoneNumber);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(LABSMOBILE_SEND_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input.message,
          tpoa: this.sender,
          recipient: [{ msisdn: to }],
          label: 'beerry-otp',
          ...encodingOptions(input.message),
        }),
        signal: controller.signal,
      });
      const providerResponse = await parseResponse(response);

      if (!response.ok || String(providerResponse.code) !== '0') {
        return this.fail({
          status: response.status,
          code: providerResponse.code,
          message: providerResponse.message || `Respuesta HTTP ${response.status}`,
          subid: providerResponse.subid,
        });
      }

      this.logger.log(
        `SMS enviado con LabsMobile. subid=${providerResponse.subid || 'N/A'} destino=${maskMsisdn(to)}`,
      );
    } catch (error) {
      if (isHttpException(error)) throw error;

      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'La solicitud a LabsMobile excedió el tiempo de espera.'
          : error instanceof Error
            ? error.message
            : 'Error de conexión desconocido.';

      return this.fail({ message });
    } finally {
      clearTimeout(timeout);
    }
  }

  private fail(details: {
    status?: number;
    code?: string | number;
    message: string;
    subid?: string;
  }): never {
    this.logger.error(
      `No se pudo enviar SMS con LabsMobile. status=${details.status ?? 'N/A'} code=${details.code ?? 'N/A'} subid=${details.subid ?? 'N/A'} message=${details.message}`,
    );

    throw serviceUnavailable('SMS_SEND_FAILED', 'No pudimos enviar el codigo por SMS.', [
      {
        provider: 'labsmobile',
        status: details.status,
        code: details.code,
        message: details.message,
        subid: details.subid,
      },
    ]);
  }
}

const requiredConfig = (config: ConfigService, key: string): string => {
  const value = (config.get<string>(key) || '').trim();
  if (!value) throw new Error(`${key} es obligatorio cuando PHONE_MESSAGE_PROVIDER=labsmobile.`);
  return value;
};

const normalizeMsisdn = (countryCode: string, phoneNumber: string): string => {
  const msisdn = `${countryCode}${phoneNumber}`.replace(/\D/g, '');
  if (msisdn.length < 8 || msisdn.length > 15) throw new Error('Número de destino inválido.');
  return msisdn;
};

const maskMsisdn = (msisdn: string): string =>
  msisdn.length <= 4 ? '****' : `${'*'.repeat(msisdn.length - 4)}${msisdn.slice(-4)}`;

// LabsMobile requiere declarar UCS-2 cuando el texto sale del repertorio ASCII.
// En ese modo un segmento admite 70 caracteres; `long` evita que un mensaje
// OTP en español quede truncado cuando contiene tildes y supera ese límite.
const encodingOptions = (message: string): { ucs2?: 1; long?: 1 } => {
  const unicode = /[^\x00-\x7F]/u.test(message);
  const segmentLimit = unicode ? 70 : 160;

  return {
    ...(unicode ? { ucs2: 1 as const } : {}),
    ...(message.length > segmentLimit ? { long: 1 as const } : {}),
  };
};

const parseResponse = async (response: Response): Promise<LabsMobileResponse> => {
  const body = await response.text();
  if (!body) return {};

  try {
    return JSON.parse(body) as LabsMobileResponse;
  } catch {
    return { message: body.slice(0, 300) };
  }
};

const isHttpException = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'getStatus' in error && 'getResponse' in error;
