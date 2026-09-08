/// <reference types="jest" />
import { OAuth } from 'mercadopago';
import { MercadoPagoOAuthClient } from '@modules/payments/infrastructure/mercado-pago-oauth.client';
describe('OAuth SDK', () => {
  afterEach(() => jest.restoreAllMocks());
  const values: Record<string, string> = {
    MERCADO_PAGO_CLIENT_ID: 'app',
    MERCADO_PAGO_CLIENT_SECRET: 'secret',
    MERCADO_PAGO_REDIRECT_URI: 'https://api.beerry.app/connect',
  };
  const client = new MercadoPagoOAuthClient({ get: (k: string) => values[k] } as never);
  it('preserves state in authorization and exchanges the code through SDK', async () => {
    expect(new URL(client.authorizationUrl('state')).searchParams.get('state')).toBe('state');
    const create = jest
      .spyOn(OAuth.prototype, 'create')
      .mockResolvedValue({ access_token: 'token', user_id: 123 } as never);
    await client.exchangeCode('code');
    expect(create).toHaveBeenCalledWith({
      body: {
        client_id: 'app',
        client_secret: 'secret',
        code: 'code',
        redirect_uri: values.MERCADO_PAGO_REDIRECT_URI,
      },
    });
  });
  it('refreshes through SDK', async () => {
    const refresh = jest
      .spyOn(OAuth.prototype, 'refresh')
      .mockResolvedValue({ access_token: 'token', user_id: 123 } as never);
    await client.refresh('refresh');
    expect(refresh).toHaveBeenCalledWith({
      body: { client_id: 'app', client_secret: 'secret', refresh_token: 'refresh' },
    });
  });
});
