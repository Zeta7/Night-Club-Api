import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, OAuth } from 'mercadopago';

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
    return this.client().getAuthorizationURL({
      options: {
        client_id: this.required('MERCADO_PAGO_CLIENT_ID'),
        state,
        redirect_uri: this.required('MERCADO_PAGO_REDIRECT_URI'),
      },
    });
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
    const credentials = {
      client_id: this.required('MERCADO_PAGO_CLIENT_ID'),
      client_secret: this.required('MERCADO_PAGO_CLIENT_SECRET'),
    };
    const oauth = this.client();
    const body =
      input.grant_type === 'refresh_token'
        ? await oauth.refresh({ body: { ...credentials, refresh_token: input.refresh_token } })
        : await oauth.create({
            body: { ...credentials, code: input.code, redirect_uri: input.redirect_uri },
          });
    if (typeof body.access_token !== 'string' || body.user_id == null)
      throw new Error('MERCADO_PAGO_OAUTH_INVALID_RESPONSE');
    return body as MercadoPagoOAuthToken;
  }

  private client() {
    // OAuth authenticates with client_id/client_secret; no seller token exists yet.
    return new OAuth(new MercadoPagoConfig({ accessToken: '', options: { timeout: 15000 } }));
  }

  private required(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value) throw new Error(`${name}_REQUIRED`);
    return value;
  }
}
