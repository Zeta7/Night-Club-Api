/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { LabsMobilePhoneMessageSender } from '@modules/notification/infrastructure/labsmobile-phone-message-sender.service';

describe('LabsMobilePhoneMessageSender', () => {
  const values: Record<string, string> = {
    LABSMOBILE_USERNAME: 'sms@beerry.pe',
    LABSMOBILE_API_TOKEN: 'api-token',
    LABSMOBILE_SENDER: 'Beerry',
  };

  const createSender = () =>
    new LabsMobilePhoneMessageSender({
      get: (key: string) => values[key],
    } as ConfigService);

  afterEach(() => jest.restoreAllMocks());

  it('envía el número en formato internacional mediante la API JSON', async () => {
    const request = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: '0', message: 'Sent', subid: 'send-123' }),
    } as Response);

    await createSender().send({
      phoneCountryCode: '+51',
      phoneNumber: '987654321',
      message: '123456 es tu codigo de Beerry.',
    });

    expect(request).toHaveBeenCalledTimes(1);
    const firstCall = request.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error('LabsMobile was not called');
    }
    const [url, options] = firstCall;
    expect(url).toBe('https://api.labsmobile.com/json/send');
    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('sms@beerry.pe:api-token').toString('base64')}`,
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(JSON.parse(String(options?.body))).toEqual({
      message: '123456 es tu codigo de Beerry.',
      tpoa: 'Beerry',
      recipient: [{ msisdn: '51987654321' }],
      label: 'beerry-otp',
    });
  });

  it('traduce un rechazo del proveedor al error público del flujo OTP', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ code: '35', message: 'The account has no enough credit', subid: 'x' }),
    } as Response);

    await expect(
      createSender().send({
        phoneCountryCode: '+51',
        phoneNumber: '987654321',
        message: 'Codigo Beerry',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({ code: 'SMS_SEND_FAILED' }),
      }),
    });
  });

  it('activa Unicode y mensajes concatenados cuando el texto en español lo requiere', async () => {
    const request = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: '0', subid: 'unicode-123' }),
    } as Response);
    const message =
      '123456 es tu código de acceso anticipado a Beerry. Vence en 10 minutos. No lo compartas.';

    await createSender().send({
      phoneCountryCode: '+51',
      phoneNumber: '987654321',
      message,
    });

    const firstCall = request.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error('LabsMobile was not called');
    }
    const payload = JSON.parse(String(firstCall[1]?.body));
    expect(payload).toEqual(expect.objectContaining({ message, ucs2: 1, long: 1 }));
  });

  it('exige las credenciales solo al seleccionar LabsMobile', () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    expect(() => new LabsMobilePhoneMessageSender(config)).toThrow('LABSMOBILE_USERNAME');
  });
});
