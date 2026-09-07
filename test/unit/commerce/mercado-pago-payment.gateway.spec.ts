/// <reference types="jest" />
import { MercadoPagoPaymentGateway } from '@modules/commerce/infrastructure/mercado-pago-payment.gateway';

describe('MercadoPagoPaymentGateway mobile checkout', () => {
  const accessTokenForClub = jest.fn();
  const configValues: Record<string, string> = {
    MERCADO_PAGO_NOTIFICATION_URL: 'https://api.beerry.app/api/v1/payments/mercado-pago/webhook',
    MOBILE_APP_SCHEME: 'beerry',
  };
  const config = {
    get: jest.fn((name: string, fallback?: string) => configValues[name] ?? fallback),
  };
  const gateway = new MercadoPagoPaymentGateway(
    config as never,
    { accessTokenForClub } as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.restoreAllMocks();
    accessTokenForClub.mockReset().mockResolvedValue({
      accessToken: 'TEST-seller-access-token',
      sellerExternalId: '3671162760',
    });
  });

  it('creates the three documented mobile return URLs and opens Checkout Pro', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'preference-1',
          collector_id: 3671162760,
          init_point: 'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=preference-1',
          sandbox_init_point:
            'https://sandbox.mercadopago.com.pe/checkout/v1/redirect?pref_id=preference-1',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await gateway.createPayment({
      attemptId: 'attempt-1',
      orderId: 'order-1',
      clubId: 'club-1',
      sellerExternalId: '3671162760',
      amountCents: 2000,
      marketplaceFeeCents: 100,
      currency: 'PEN',
      payerEmail: 'buyer@beerry.test',
      subject: 'Compra Beerry',
    });

    const request = fetchMock.mock.calls[0]![1]!;
    const body = JSON.parse(String(request.body));
    expect(body.back_urls).toEqual({
      success:
        'beerry://payments/result?provider=mercado_pago&attemptId=attempt-1&operationType=ORDER&operationId=order-1&result=success',
      pending:
        'beerry://payments/result?provider=mercado_pago&attemptId=attempt-1&operationType=ORDER&operationId=order-1&result=pending',
      failure:
        'beerry://payments/result?provider=mercado_pago&attemptId=attempt-1&operationType=ORDER&operationId=order-1&result=failure',
    });
    expect(body.auto_return).toBe('approved');
    expect(body.notification_url).toBe(configValues.MERCADO_PAGO_NOTIFICATION_URL);
    expect(body.marketplace_fee).toBe(1);
    expect(body.payer).toBeUndefined();
    expect(result.checkoutUrl).toBe(
      'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=preference-1',
    );
  });

  it('does not select sandbox_init_point even when Mercado Pago returns it', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'preference-2',
          collector_id: 3671162760,
          init_point: 'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=preference-2',
          sandbox_init_point:
            'https://sandbox.mercadopago.com.pe/checkout/v1/redirect?pref_id=preference-2',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await gateway.createPayment({
      attemptId: 'attempt-2',
      orderId: 'order-2',
      clubId: 'club-1',
      sellerExternalId: '3671162760',
      amountCents: 2000,
      marketplaceFeeCents: 100,
      currency: 'PEN',
      payerEmail: 'buyer@beerry.test',
      subject: 'Compra Beerry',
    });

    const request = fetchMock.mock.calls[0]![1]!;
    expect(JSON.parse(String(request.body)).payer).toBeUndefined();
    expect(result.checkoutUrl).toBe(
      'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=preference-2',
    );
  });
});
