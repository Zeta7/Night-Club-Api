import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { FlowPaymentGateway } from './flow-payment.gateway';

describe('FlowPaymentGateway', () => {
  const values: Record<string, string> = {
    FLOW_API_KEY: 'test-api-key',
    FLOW_SECRET_KEY: 'test-secret',
    FLOW_API_URL: 'https://sandbox.flow.cl/api',
    FLOW_CONFIRMATION_URL: 'https://api.beerry.test/payments/flow/confirmation',
    FLOW_RETURN_URL: 'https://api.beerry.test/payments/flow/return',
  };
  const gateway = new FlowPaymentGateway({
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as ConfigService);

  afterEach(() => jest.restoreAllMocks());

  it('signs parameters in ascending key order using HMAC-SHA256', () => {
    const expected = createHmac('sha256', 'test-secret')
      .update('amount10apiKeyabccurrencyPEN')
      .digest('hex');
    expect(gateway.sign({ currency: 'PEN', apiKey: 'abc', amount: 10 })).toBe(expected);
  });

  it('creates a PEN checkout URL without exposing the secret', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          url: 'https://sandbox.flow.cl/app/pay.php',
          token: 'tok-123',
          flowOrder: 44,
        }),
        {
          status: 200,
        },
      ),
    );
    const result = await gateway.createPayment({
      attemptId: 'attempt-1',
      orderId: 'order-1',
      amountCents: 1234,
      currency: 'PEN',
      payerEmail: 'cliente@beerry.test',
      subject: 'Compra Beerry',
    });
    expect(result.checkoutUrl).toBe('https://sandbox.flow.cl/app/pay.php?token=tok-123');
    expect(result.externalPaymentId).toBe('tok-123');
    const request = fetchMock.mock.calls[0];
    expect(String(request[1]?.body)).toContain('amount=12.34');
    expect(String(request[1]?.body)).not.toContain('test-secret');
  });

  it('maps a verified paid status to an approved idempotent event', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          flowOrder: 99,
          commerceOrder: 'attempt-1',
          status: 2,
          currency: 'PEN',
          amount: 12.34,
          payer: 'cliente@beerry.test',
        }),
        { status: 200 },
      ),
    );
    const event = await gateway.verifyPaymentToken('tok-123');
    expect(event).toMatchObject({
      provider: 'flow',
      providerEventId: 'flow:99:2',
      externalPaymentId: 'tok-123',
      outcome: 'APPROVED',
    });
  });
});
