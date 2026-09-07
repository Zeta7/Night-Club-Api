/// <reference types="jest" />
import { MercadoPagoOAuthClient } from '@modules/payments/infrastructure/mercado-pago-oauth.client';

describe('MercadoPagoOAuthClient for Orders API', () => {
  it('exchanges a seller authorization code without unsupported test credentials', async () => {
    const values: Record<string, string> = {
      MERCADO_PAGO_CLIENT_ID: 'client-id',
      MERCADO_PAGO_CLIENT_SECRET: 'client-secret',
      MERCADO_PAGO_REDIRECT_URI: 'https://api.beerry.app/oauth/callback',
    };
    const config = { get: jest.fn((name: string) => values[name]) };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'APP_USR-token', user_id: 123 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await new MercadoPagoOAuthClient(config as never).exchangeCode('authorization-code');

    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({
      client_id: 'client-id',
      client_secret: 'client-secret',
      grant_type: 'authorization_code',
      code: 'authorization-code',
      redirect_uri: 'https://api.beerry.app/oauth/callback',
    });
  });
});
