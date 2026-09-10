/// <reference types="jest" />
import { Preference, Payment, PaymentRefund } from 'mercadopago';
import { MercadoPagoPaymentGateway } from '@modules/commerce/infrastructure/mercado-pago-payment.gateway';
describe('Mercado Pago SDK gateway', () => {
  afterEach(() => jest.restoreAllMocks());
  const values: Record<string, string> = {
    MERCADO_PAGO_ENVIRONMENT: 'test',
    MOBILE_APP_SCHEME: 'beerry',
    MERCADO_PAGO_NOTIFICATION_URL: 'https://api.beerry.app/webhook',
  };
  const gateway = new MercadoPagoPaymentGateway(
    { get: (key: string) => values[key] } as never,
    {
      accessTokenForClub: async () => ({ accessToken: 'seller-token', sellerExternalId: '123' }),
    } as never,
    {
      marketplaceSellerConnection: {
        findUnique: async () => ({ status: 'CONNECTED', accessTokenEncrypted: 'encrypted' }),
      },
      paymentAttempt: {
        findUnique: async () => ({
          externalPaymentId: 'preference-id',
          orderId: null,
          walletTopUpId: null,
          featuredCampaignId: 'campaign',
          order: null,
        }),
      },
    } as never,
    { decrypt: () => 'seller-token' } as never,
  );
  const input = {
    attemptId: 'attempt',
    orderId: 'order',
    clubId: 'club',
    amountCents: 2500,
    marketplaceFeeCents: 250,
    currency: 'PEN',
    subject: 'Compra',
  };
  it.each(['test', 'production'])(
    'creates a preference in %s using seller credentials',
    async (environment) => {
      values.MERCADO_PAGO_ENVIRONMENT = environment;
      const create = jest.spyOn(Preference.prototype, 'create').mockImplementation(async function (
        this: Preference,
      ) {
        expect((this as unknown as { config: { accessToken: string } }).config.accessToken).toBe(
          'seller-token',
        );
        return {
          id: 'pref',
          collector_id: 123,
          init_point: 'https://www.mercadopago.com.pe/pay',
          sandbox_init_point: 'https://sandbox.mercadopago.com.pe/pay',
        } as never;
      });
      const result = await gateway.createPayment(input);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestOptions: { idempotencyKey: 'attempt' },
          body: expect.objectContaining({
            marketplace_fee: 2.5,
            items: [expect.objectContaining({ unit_price: 25, currency_id: 'PEN' })],
          }),
        }),
      );
      expect(create.mock.calls[0][0].body).not.toHaveProperty('payer');
      expect(result.checkoutUrl).toContain(environment === 'test' ? 'sandbox.' : 'www.');
    },
  );
  it('rejects excessive fees before SDK invocation', async () => {
    const create = jest.spyOn(Preference.prototype, 'create');
    await expect(gateway.createPayment({ ...input, marketplaceFeeCents: 2501 })).rejects.toThrow(
      'INVALID_MARKETPLACE_FEE',
    );
    expect(create).not.toHaveBeenCalled();
  });
  it('finds an approved advertising payment by its attempt reference', async () => {
    const search = jest.spyOn(Payment.prototype, 'search').mockResolvedValue({
      results: [{ id: '987654', external_reference: 'attempt' }],
    } as never);
    const get = jest.spyOn(Payment.prototype, 'get').mockResolvedValue({
      id: 987654,
      status: 'approved',
      status_detail: 'accredited',
      external_reference: 'attempt',
      metadata: {
        attempt_id: 'attempt',
        order_id: 'campaign',
        operation_type: 'FEATURED_CAMPAIGN',
      },
      transaction_amount: 25,
      currency_id: 'PEN',
      collector_id: 123,
      fee_details: [],
      date_last_updated: '2026-09-10T12:00:00Z',
    } as never);

    const event = await gateway.queryPaymentByExternalReference('attempt', '123');

    expect(search).toHaveBeenCalledWith({
      options: expect.objectContaining({ external_reference: 'attempt' }),
    });
    expect(get).toHaveBeenCalledWith({ id: '987654' });
    expect(event).toEqual(
      expect.objectContaining({
        externalPaymentId: '987654',
        attemptId: 'attempt',
        orderId: 'campaign',
        outcome: 'APPROVED',
      }),
    );
  });
  it('refunds using the payment ID and numeric amount', async () => {
    jest.spyOn(Payment.prototype, 'get').mockResolvedValue({ transaction_amount: 25 } as never);
    const refund = jest
      .spyOn(PaymentRefund.prototype, 'create')
      .mockResolvedValue({ id: 789 } as never);
    await gateway.createRefund({
      paymentId: '456',
      sellerExternalId: '123',
      amountCents: 500,
      idempotencyKey: 'refund',
    });
    expect(refund).toHaveBeenCalledWith({
      payment_id: '456',
      body: { amount: 5 },
      requestOptions: { idempotencyKey: 'refund' },
    });
  });
});
