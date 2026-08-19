import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentGateway,
  PaymentOutcome,
  VerifiedPaymentEvent,
} from '../application/ports/payment-gateway.port';

type FlowCreateResponse = {
  url: string;
  token: string;
  flowOrder?: number;
};

type FlowPaymentStatus = {
  flowOrder: number;
  commerceOrder: string;
  status: number;
  currency: string;
  amount: number;
  payer?: string;
  paymentData?: Record<string, unknown>;
  pending_info?: Record<string, unknown>;
};

@Injectable()
export class FlowPaymentGateway implements PaymentGateway {
  readonly provider = 'flow';

  constructor(private readonly config: ConfigService) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (input.currency !== 'PEN') {
      throw new Error(`FLOW_UNSUPPORTED_CURRENCY:${input.currency}`);
    }
    if (input.amountCents <= 0) throw new Error('FLOW_AMOUNT_MUST_BE_POSITIVE');
    const params = {
      apiKey: this.required('FLOW_API_KEY'),
      commerceOrder: input.attemptId,
      subject: input.subject.slice(0, 80),
      currency: input.currency,
      amount: this.decimalAmount(input.amountCents),
      email: input.payerEmail,
      urlConfirmation: this.required('FLOW_CONFIRMATION_URL'),
      urlReturn: this.required('FLOW_RETURN_URL'),
    };
    const response = await this.post<FlowCreateResponse>('/payment/create', params);
    if (!response.token || !response.url) throw new Error('FLOW_INVALID_CREATE_RESPONSE');
    const checkoutUrl = `${response.url}?token=${encodeURIComponent(response.token)}`;
    return {
      externalPaymentId: response.token,
      status: 'PENDING',
      checkoutUrl,
      providerData: {
        token: response.token,
        flowOrder: response.flowOrder,
        commerceOrder: input.attemptId,
        checkoutUrl,
      },
    };
  }

  async verifyPaymentToken(token: string): Promise<VerifiedPaymentEvent> {
    if (!token?.trim()) throw new Error('FLOW_TOKEN_REQUIRED');
    const status = await this.get<FlowPaymentStatus>('/payment/getStatus', {
      apiKey: this.required('FLOW_API_KEY'),
      token: token.trim(),
    });
    const outcome = this.mapStatus(status.status);
    return {
      provider: this.provider,
      providerEventId: `flow:${status.flowOrder}:${status.status}`,
      externalPaymentId: token.trim(),
      outcome,
      failureCode: outcome === 'REJECTED' ? `FLOW_STATUS_${status.status}` : undefined,
      failureMessage:
        outcome === 'REJECTED' ? 'Flow informó que el pago fue rechazado o cancelado.' : undefined,
      payload: status as unknown as Record<string, unknown>,
    };
  }

  sign(params: Record<string, string | number>): string {
    const value = Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join('');
    return createHmac('sha256', this.required('FLOW_SECRET_KEY')).update(value).digest('hex');
  }

  private mapStatus(status: number): PaymentOutcome {
    if (status === 2) return 'APPROVED';
    if (status === 3 || status === 4) return 'REJECTED';
    return 'PENDING';
  }

  private decimalAmount(amountCents: number) {
    return (amountCents / 100).toFixed(2);
  }

  private async post<T>(path: string, unsigned: Record<string, string | number>): Promise<T> {
    const body = new URLSearchParams({
      ...Object.fromEntries(Object.entries(unsigned).map(([key, value]) => [key, String(value)])),
      s: this.sign(unsigned),
    });
    const response = await fetch(`${this.baseUrl()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    return this.read<T>(response);
  }

  private async get<T>(path: string, unsigned: Record<string, string | number>): Promise<T> {
    const query = new URLSearchParams({
      ...Object.fromEntries(Object.entries(unsigned).map(([key, value]) => [key, String(value)])),
      s: this.sign(unsigned),
    });
    const response = await fetch(`${this.baseUrl()}${path}?${query.toString()}`);
    return this.read<T>(response);
  }

  private async read<T>(response: Response): Promise<T> {
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`FLOW_INVALID_JSON:${response.status}`);
    }
    if (!response.ok || (data && typeof data === 'object' && 'code' in data)) {
      const detail =
        data && typeof data === 'object' && 'message' in data ? String(data.message) : text;
      throw new Error(`FLOW_API_ERROR:${response.status}:${detail}`);
    }
    return data as T;
  }

  private baseUrl() {
    return this.config
      .get<string>('FLOW_API_URL', 'https://sandbox.flow.cl/api')
      .replace(/\/$/, '');
  }

  private required(key: string) {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new Error(`${key}_REQUIRED`);
    return value;
  }
}
