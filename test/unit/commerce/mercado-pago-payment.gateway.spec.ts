/// <reference types="jest" />
import { MercadoPagoPaymentGateway } from '@modules/commerce/infrastructure/mercado-pago-payment.gateway';

describe('MercadoPagoPaymentGateway Checkout Pro Preferences API', () => {
  const accessTokenForClub = jest.fn();
  const prisma = { paymentAttempt: { findUnique: jest.fn() } };
  const configValues: Record<string, string> = {
    MERCADO_PAGO_NOTIFICATION_URL: 'https://api.beerry.app/api/v1/payments/mercado-pago/webhook',
    MOBILE_APP_SCHEME: 'beerry',
    MERCADO_PAGO_CLIENT_ID: '5106228891748811',
    MERCADO_PAGO_ENVIRONMENT: 'test',
  };
  const config = {
    get: jest.fn((name: string, fallback?: string) => configValues[name] ?? fallback),
  };
  const gateway = new MercadoPagoPaymentGateway(
    config as never,
    { accessTokenForClub } as never,
    prisma as never,
    {} as never,
  );

  beforeEach(() => {
    jest.restoreAllMocks();
    accessTokenForClub.mockReset().mockResolvedValue({
      accessToken: 'APP_USR-seller-access-token',
      sellerExternalId: '3671162760',
    });
    prisma.paymentAttempt.findUnique.mockReset();
  });

  it('creates a marketplace preference with the seller OAuth token and fee', async () => {
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
      payerEmail: 'ignored@example.com',
      subject: 'Compra Beerry',
    });

    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://api.mercadopago.com/checkout/preferences',
    );
    const request = fetchMock.mock.calls[0]![1]!;
    expect((request.headers as Record<string, string>)['x-idempotency-key']).toBe('attempt-1');
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      marketplace_fee: 1,
      external_reference: 'attempt-1',
      notification_url: configValues.MERCADO_PAGO_NOTIFICATION_URL,
      back_urls: {
        success:
          'beerry://payments/result?provider=mercado_pago&attemptId=attempt-1&operationType=ORDER&operationId=order-1&result=success',
        pending:
          'beerry://payments/result?provider=mercado_pago&attemptId=attempt-1&operationType=ORDER&operationId=order-1&result=pending',
        failure:
          'beerry://payments/result?provider=mercado_pago&attemptId=attempt-1&operationType=ORDER&operationId=order-1&result=failure',
      },
      auto_return: 'approved',
      metadata: { attempt_id: 'attempt-1', order_id: 'order-1', club_id: 'club-1' },
      items: [
        {
          id: 'order-1',
          title: 'Compra Beerry',
          quantity: 1,
          unit_price: 20,
          currency_id: 'PEN',
        },
      ],
    });
    expect(body.payer).toBeUndefined();
    expect(result).toMatchObject({
      externalPaymentId: 'preference-1',
      checkoutUrl: 'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=preference-1',
      sellerExternalId: '3671162760',
      providerData: { preferenceId: 'preference-1', api: 'preferences' },
    });
  });

  it('rejects an invalid marketplace fee before calling Mercado Pago', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(
      gateway.createPayment({
        attemptId: 'attempt-2',
        orderId: 'order-2',
        clubId: 'club-1',
        amountCents: 2000,
        marketplaceFeeCents: 2001,
        currency: 'PEN',
        subject: 'Compra Beerry',
      }),
    ).rejects.toThrow('MERCADO_PAGO_INVALID_MARKETPLACE_FEE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('verifies an approved order against Mercado Pago and the local snapshot', async () => {
    prisma.paymentAttempt.findUnique.mockResolvedValue({
      externalPaymentId: 'ORDTST-order-3',
      orderId: 'order-3',
      walletTopUpId: null,
      order: { clubId: 'club-1' },
      walletTopUp: null,
    });
    const cipher = { decrypt: jest.fn(() => 'APP_USR-seller-access-token') };
    const queryGateway = new MercadoPagoPaymentGateway(
      config as never,
      { accessTokenForClub } as never,
      {
        ...prisma,
        marketplaceSellerConnection: {
          findUnique: jest.fn().mockResolvedValue({
            status: 'CONNECTED',
            accessTokenEncrypted: 'encrypted',
          }),
        },
      } as never,
      cipher as never,
    );
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'ORDTST-order-3',
          status: 'processed',
          status_detail: 'accredited',
          external_reference: 'attempt-3',
          total_amount: '50.00',
          marketplace_fee: '5.00',
          currency: 'PEN',
          user_id: '3671162760',
          last_updated_date: '2026-09-07T10:00:00Z',
          transactions: {
            payments: [{ id: 'PAY-payment-3', status: 'processed', status_detail: 'accredited' }],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(queryGateway.queryOrder('ORDTST-order-3', '3671162760')).resolves.toMatchObject({
      externalPaymentId: 'ORDTST-order-3',
      outcome: 'APPROVED',
      attemptId: 'attempt-3',
      orderId: 'order-3',
      clubId: 'club-1',
      amountCents: 5000,
      currency: 'PEN',
      sellerExternalId: '3671162760',
      marketplaceFeeCents: 500,
    });
  });

  it('keeps test payer data out of production orders', async () => {
    configValues.MERCADO_PAGO_ENVIRONMENT = 'production';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'preference-production-1',
          collector_id: 3671162760,
          init_point:
            'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=preference-production-1',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );

    try {
      await gateway.createPayment({
        attemptId: 'attempt-production',
        orderId: 'order-production',
        clubId: 'club-1',
        sellerExternalId: '3671162760',
        amountCents: 2000,
        marketplaceFeeCents: 100,
        currency: 'PEN',
        subject: 'Compra Beerry',
      });
      expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).not.toHaveProperty('payer');
    } finally {
      configValues.MERCADO_PAGO_ENVIRONMENT = 'test';
    }
  });
});
