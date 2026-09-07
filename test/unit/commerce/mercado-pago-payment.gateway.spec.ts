/// <reference types="jest" />
import { MercadoPagoPaymentGateway } from '@modules/commerce/infrastructure/mercado-pago-payment.gateway';

describe('MercadoPagoPaymentGateway Checkout Pro Orders API', () => {
  const accessTokenForClub = jest.fn();
  const prisma = { paymentAttempt: { findUnique: jest.fn() } };
  const configValues: Record<string, string> = {
    MERCADO_PAGO_NOTIFICATION_URL: 'https://api.beerry.app/api/v1/payments/mercado-pago/webhook',
    MOBILE_APP_SCHEME: 'beerry',
    MERCADO_PAGO_TEST_PAYER_EMAIL: 'buyer@testuser.com',
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

  it('creates a marketplace order using the documented Orders API contract', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'ORDTST-order-1',
          user_id: '3671162760',
          currency: 'PEN',
          country_code: 'PE',
          checkout_url:
            'https://www.mercadopago.com.pe/checkout/v1/redirect?order_id=ORDTST-order-1',
          integration_data: { application_id: '5106228891748811' },
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

    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.mercadopago.com/v1/orders');
    const request = fetchMock.mock.calls[0]![1]!;
    expect((request.headers as Record<string, string>)['x-idempotency-key']).toBe('attempt-1');
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      type: 'online',
      processing_mode: 'manual',
      total_amount: '20.00',
      marketplace_fee: '1.00',
      external_reference: 'attempt-1',
      config: {
        online: {
          callback_url: configValues.MERCADO_PAGO_NOTIFICATION_URL,
          success_url:
            'beerry://payments/result?provider=mercado_pago&attemptId=attempt-1&operationType=ORDER&operationId=order-1&result=success',
          pending_url:
            'beerry://payments/result?provider=mercado_pago&attemptId=attempt-1&operationType=ORDER&operationId=order-1&result=pending',
          failure_url:
            'beerry://payments/result?provider=mercado_pago&attemptId=attempt-1&operationType=ORDER&operationId=order-1&result=failure',
          auto_return: 'approved',
        },
      },
      items: [
        {
          title: 'Compra Beerry',
          quantity: 1,
          unit_price: '20.00',
        },
      ],
    });
    expect(body.payer).toEqual({ email: 'buyer@testuser.com' });
    expect(body.back_urls).toBeUndefined();
    expect(body.notification_url).toBeUndefined();
    expect(result).toMatchObject({
      externalPaymentId: 'ORDTST-order-1',
      checkoutUrl: 'https://www.mercadopago.com.pe/checkout/v1/redirect?order_id=ORDTST-order-1',
      sellerExternalId: '3671162760',
      providerData: { mercadoPagoOrderId: 'ORDTST-order-1', api: 'orders' },
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
});
