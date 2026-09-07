import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MercadoPagoOAuthToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  user_id: number | string;
  public_key?: string;
};

@Injectable()
export class MercadoPagoOAuthClient {
  constructor(private readonly config: ConfigService) {}

  authorizationUrl(state: string) {
    const url = new URL('https://auth.mercadopago.com/authorization');
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.required('MERCADO_PAGO_CLIENT_ID'),
      platform_id: 'mp',
      state,
      redirect_uri: this.required('MERCADO_PAGO_REDIRECT_URI'),
    }).toString();
    return url.toString();
  }

  exchangeCode(code: string): Promise<MercadoPagoOAuthToken> {
    return this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.required('MERCADO_PAGO_REDIRECT_URI'),
    });
  }

  refresh(refreshToken: string): Promise<MercadoPagoOAuthToken> {
    return this.token({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  private async token(input: Record<string, string>) {
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.required('MERCADO_PAGO_CLIENT_ID'),
        client_secret: this.required('MERCADO_PAGO_CLIENT_SECRET'),
        ...input,
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok || typeof body.access_token !== 'string' || body.user_id == null)
      throw new Error(`MERCADO_PAGO_OAUTH_ERROR:${response.status}`);
    return body as MercadoPagoOAuthToken;
  }

  private required(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value) throw new Error(`${name}_REQUIRED`);
    return value;
  }
}
