import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { SellerConnectionService } from '../../payments/application/seller-connection.service';
import { SellerCredentialCipher } from '../../payments/infrastructure/seller-credential-cipher';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  CreateRefundInput,
  CreateRefundResult,
  PaymentOutcome,
  VerifiedPaymentEvent,
} from '../application/ports/payment-gateway.port';

@Injectable()
export class MercadoPagoPaymentGateway {
  readonly provider = 'mercado_pago';
  private readonly logger = new Logger(MercadoPagoPaymentGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly connections: SellerConnectionService,
    private readonly prisma: PrismaService,
    private readonly cipher: SellerCredentialCipher,
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const environment = this.paymentEnvironment();
    this.logger.log(
      JSON.stringify({
        event: 'mercado_pago.order.create.started',
        attemptId: input.attemptId,
        orderId: input.orderId,
        clubId: input.clubId ?? null,
        amountCents: input.amountCents,
        currency: input.currency,
        marketplaceFeeCents: input.marketplaceFeeCents ?? null,
        api: 'orders',
        environment,
      }),
    );
    const seller = input.clubId
      ? await this.connections.accessTokenForClub(input.clubId)
      : {
          accessToken: this.required('MERCADO_PAGO_PLATFORM_ACCESS_TOKEN'),
          sellerExternalId: undefined,
        };
    if (
      input.clubId &&
      (!Number.isInteger(input.marketplaceFeeCents) ||
        input.marketplaceFeeCents! < 0 ||
        input.marketplaceFeeCents! > input.amountCents)
    )
      throw new Error('MERCADO_PAGO_INVALID_MARKETPLACE_FEE');
    if (input.sellerExternalId && input.sellerExternalId !== seller.sellerExternalId)
      throw new Error('MERCADO_PAGO_SELLER_MISMATCH');
    const amount = money(input.amountCents);
    const testPayerEmail = this.payerEmailFor(environment);
    const response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${seller.accessToken}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'x-idempotency-key': input.attemptId,
      },
      body: JSON.stringify({
        type: 'online',
        processing_mode: 'manual',
        total_amount: amount,
        external_reference: input.attemptId,
        ...(testPayerEmail ? { payer: { email: testPayerEmail } } : {}),
        ...(input.clubId ? { marketplace_fee: money(input.marketplaceFeeCents!) } : {}),
        config: {
          online: {
            callback_url: this.required('MERCADO_PAGO_NOTIFICATION_URL'),
            success_url: this.mobileReturnUrl(input, 'success'),
            pending_url: this.mobileReturnUrl(input, 'pending'),
            failure_url: this.mobileReturnUrl(input, 'failure'),
            auto_return: 'approved',
          },
        },
        items: [
          {
            title: input.subject,
            quantity: 1,
            unit_price: amount,
            unit_measure: 'unit',
            total_amount: amount,
          },
        ],
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok || typeof body.id !== 'string') {
      this.logger.error(
        JSON.stringify({
          event: 'mercado_pago.order.create.failed',
          attemptId: input.attemptId,
          orderId: input.orderId,
          clubId: input.clubId ?? null,
          statusCode: response.status,
          statusText: response.statusText || null,
          mercadoPagoRequestId: response.headers.get('x-request-id'),
          response: mercadoPagoErrorDetails(body),
        }),
      );
      throw new Error(`MERCADO_PAGO_CREATE_ERROR:${response.status}`);
    }
    this.assertCreatedOrder(body, input, seller.sellerExternalId, environment);
    const checkoutUrl = body.checkout_url;
    if (typeof checkoutUrl !== 'string') {
      this.logger.error(
        JSON.stringify({
          event: 'mercado_pago.order.checkout_url_missing',
          attemptId: input.attemptId,
          orderId: input.orderId,
          clubId: input.clubId ?? null,
          mercadoPagoOrderId: body.id,
        }),
      );
      throw new Error('MERCADO_PAGO_CHECKOUT_URL_MISSING');
    }
    this.logger.log(
      JSON.stringify({
        event: 'mercado_pago.order.create.succeeded',
        attemptId: input.attemptId,
        orderId: input.orderId,
        clubId: input.clubId ?? null,
        mercadoPagoOrderId: body.id,
        collectorId: stringValue(body.user_id) ?? seller.sellerExternalId ?? null,
        sellerExternalId: seller.sellerExternalId ?? null,
        applicationId: stringValue((body.integration_data as any)?.application_id) ?? null,
        countryCode: stringValue(body.country_code) ?? null,
        currency: stringValue(body.currency) ?? null,
        status: stringValue(body.status) ?? null,
        statusDetail: stringValue(body.status_detail) ?? null,
        captureMode: stringValue(body.capture_mode) ?? null,
        testPayerEmail: testPayerEmail ? maskEmail(testPayerEmail) : null,
        mercadoPagoRequestId: response.headers.get('x-request-id'),
        environment,
        checkoutHost: new URL(checkoutUrl).host,
      }),
    );
    return {
      externalPaymentId: body.id,
      status: 'PENDING',
      checkoutUrl,
      sellerExternalId: seller.sellerExternalId ?? stringValue(body.user_id),
      providerData: { mercadoPagoOrderId: body.id, api: 'orders' },
    };
  }

  queryExternalPayment(externalPaymentId: string, sellerExternalId?: string) {
    if (!sellerExternalId) throw new Error('MERCADO_PAGO_SELLER_REQUIRED');
    return this.queryOrder(externalPaymentId, sellerExternalId);
  }

  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
    const connection = await this.prisma.marketplaceSellerConnection.findUnique({
      where: {
        provider_externalSellerId: {
          provider: this.provider,
          externalSellerId: input.sellerExternalId,
        },
      },
    });
    if (!connection || connection.status !== 'CONNECTED')
      throw new Error('MERCADO_PAGO_SELLER_CONNECTION_NOT_FOUND');
    const accessToken = this.cipher.decrypt(connection.accessTokenEncrypted);
    const orderResponse = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(input.paymentId)}`,
      { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } },
    );
    const order = (await orderResponse.json()) as Record<string, any>;
    if (!orderResponse.ok)
      throw new Error(`MERCADO_PAGO_ORDER_QUERY_ERROR:${orderResponse.status}`);
    const transactionId = stringValue(order.transactions?.payments?.[0]?.id);
    const totalAmountCents = moneyToCents(order.total_amount);
    const isFullRefund = input.amountCents === totalAmountCents;
    if (!isFullRefund && !transactionId)
      throw new Error('MERCADO_PAGO_REFUND_TRANSACTION_REQUIRED');
    if (input.amountCents <= 0 || input.amountCents > totalAmountCents)
      throw new Error('MERCADO_PAGO_INVALID_REFUND_AMOUNT');

    const response = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(input.paymentId)}/refund`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
          'x-idempotency-key': input.idempotencyKey,
        },
        body: JSON.stringify(
          isFullRefund
            ? {}
            : { transactions: [{ id: transactionId, amount: money(input.amountCents) }] },
        ),
      },
    );
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok || body.id == null)
      throw new Error(`MERCADO_PAGO_REFUND_ERROR:${response.status}`);
    const refunds = Array.isArray((body as any).transactions?.refunds)
      ? (body as any).transactions.refunds
      : [];
    return {
      externalRefundId: String(refunds.at(-1)?.id ?? body.id),
      status: 'PENDING',
    };
  }

  async queryPayment(paymentId: string, sellerExternalId: string): Promise<VerifiedPaymentEvent> {
    const connection = await this.prisma.marketplaceSellerConnection.findUnique({
      where: {
        provider_externalSellerId: { provider: this.provider, externalSellerId: sellerExternalId },
      },
    });
    const accessToken = connection
      ? this.cipher.decrypt(connection.accessTokenEncrypted)
      : this.required('MERCADO_PAGO_PLATFORM_ACCESS_TOKEN');
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
      },
    );
    const body = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      this.logger.error(
        JSON.stringify({
          event: 'mercado_pago.payment.query_failed',
          paymentId,
          sellerExternalId,
          statusCode: response.status,
          response: mercadoPagoErrorDetails(body),
        }),
      );
      throw new Error(`MERCADO_PAGO_QUERY_ERROR:${response.status}`);
    }
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
    const attemptId = stringValue(metadata.attempt_id) ?? stringValue(body.external_reference);
    const snapshot = await this.paymentSnapshot(attemptId);
    const event: VerifiedPaymentEvent = {
      provider: this.provider,
      providerEventId: `payment:${paymentId}:${String(body.status)}:${String(body.date_last_updated ?? '')}`,
      externalPaymentId: snapshot?.externalPaymentId ?? String(body.id),
      outcome: mapStatus(String(body.status), String(body.status_detail ?? '')),
      failureCode:
        body.status === 'rejected'
          ? `MERCADO_PAGO_${String(body.status_detail ?? 'REJECTED').toUpperCase()}`
          : undefined,
      failureMessage: body.status === 'rejected' ? 'Mercado Pago rechazó el pago.' : undefined,
      attemptId,
      orderId: stringValue(metadata.order_id) ?? snapshot?.operationId,
      clubId: stringValue(metadata.club_id) ?? snapshot?.clubId,
      amountCents: moneyToCents(body.transaction_amount),
      currency: stringValue(body.currency_id),
      sellerExternalId: String(body.collector_id ?? sellerExternalId),
      marketplaceFeeCents: moneyToCents(
        body.fee_details?.find((fee: any) => fee?.type === 'application_fee')?.amount ??
          body.marketplace_fee ??
          0,
      ),
      refundedAmountCents: moneyToCents(body.transaction_amount_refunded ?? 0),
      payload: {
        id: String(body.id),
        status: body.status,
        statusDetail: body.status_detail,
        externalReference: body.external_reference,
        metadata,
        transactionAmount: body.transaction_amount,
        currencyId: body.currency_id,
        collectorId: body.collector_id,
        feeDetails: body.fee_details,
      },
    };
    this.logger.log(
      JSON.stringify({
        event: 'mercado_pago.payment.queried',
        paymentId,
        sellerExternalId,
        attemptId: event.attemptId ?? null,
        orderId: event.orderId ?? null,
        outcome: event.outcome,
        status: stringValue(body.status) ?? null,
        statusDetail: stringValue(body.status_detail) ?? null,
      }),
    );
    return event;
  }

  async queryOrder(
    mercadoPagoOrderId: string,
    sellerExternalId: string,
  ): Promise<VerifiedPaymentEvent> {
    const accessToken = await this.accessTokenForSeller(sellerExternalId);
    const response = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(mercadoPagoOrderId)}`,
      { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } },
    );
    const body = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      this.logger.error(
        JSON.stringify({
          event: 'mercado_pago.order.query_failed',
          mercadoPagoOrderId,
          sellerExternalId,
          statusCode: response.status,
          response: mercadoPagoErrorDetails(body),
        }),
      );
      throw new Error(`MERCADO_PAGO_ORDER_QUERY_ERROR:${response.status}`);
    }
    const attemptId = stringValue(body.external_reference);
    const snapshot = await this.paymentSnapshot(attemptId);
    const payment = Array.isArray(body.transactions?.payments)
      ? body.transactions.payments[0]
      : undefined;
    const status = String(payment?.status ?? body.status ?? '');
    const statusDetail = String(payment?.status_detail ?? body.status_detail ?? '');
    const event: VerifiedPaymentEvent = {
      provider: this.provider,
      providerEventId: `order:${mercadoPagoOrderId}:${status}:${String(body.last_updated_date ?? '')}`,
      externalPaymentId: snapshot?.externalPaymentId ?? String(body.id),
      outcome: mapOrderStatus(status, statusDetail),
      failureCode:
        status === 'failed' || status === 'rejected'
          ? `MERCADO_PAGO_${statusDetail.toUpperCase() || 'REJECTED'}`
          : undefined,
      failureMessage:
        status === 'failed' || status === 'rejected' ? 'Mercado Pago rechazó el pago.' : undefined,
      attemptId,
      orderId: snapshot?.operationId,
      clubId: snapshot?.clubId,
      amountCents: moneyToCents(body.total_amount),
      currency: stringValue(body.currency),
      sellerExternalId: String(body.user_id ?? sellerExternalId),
      marketplaceFeeCents: moneyToCents(body.marketplace_fee ?? 0),
      refundedAmountCents: Array.isArray(body.transactions?.refunds)
        ? body.transactions.refunds.reduce(
            (total: number, refund: any) => total + moneyToCents(refund?.amount ?? 0),
            0,
          )
        : 0,
      payload: {
        id: String(body.id),
        status: body.status,
        statusDetail: body.status_detail,
        externalReference: body.external_reference,
        totalAmount: body.total_amount,
        currency: body.currency,
        userId: body.user_id,
        marketplaceFee: body.marketplace_fee,
        paymentId: payment?.id,
        paymentStatus: payment?.status,
      },
    };
    this.logger.log(
      JSON.stringify({
        event: 'mercado_pago.order.queried',
        mercadoPagoOrderId,
        sellerExternalId,
        attemptId: event.attemptId ?? null,
        orderId: event.orderId ?? null,
        outcome: event.outcome,
        status: stringValue(body.status) ?? null,
        statusDetail: stringValue(body.status_detail) ?? null,
        paymentId: stringValue(payment?.id) ?? null,
        paymentStatus: stringValue(payment?.status) ?? null,
        paymentStatusDetail: stringValue(payment?.status_detail) ?? null,
      }),
    );
    return event;
  }

  private async accessTokenForSeller(sellerExternalId: string) {
    const connection = await this.prisma.marketplaceSellerConnection.findUnique({
      where: {
        provider_externalSellerId: { provider: this.provider, externalSellerId: sellerExternalId },
      },
    });
    return connection
      ? this.cipher.decrypt(connection.accessTokenEncrypted)
      : this.required('MERCADO_PAGO_PLATFORM_ACCESS_TOKEN');
  }

  private async paymentSnapshot(attemptId: string | undefined) {
    if (!attemptId) return undefined;
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
      include: { order: { select: { clubId: true } }, walletTopUp: { select: { id: true } } },
    });
    if (!attempt) return undefined;
    return {
      externalPaymentId: attempt.externalPaymentId ?? undefined,
      operationId: attempt.orderId ?? attempt.walletTopUpId ?? undefined,
      clubId: attempt.order?.clubId ?? undefined,
    };
  }

  private required(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value) throw new Error(`${name}_REQUIRED`);
    return value;
  }

  private paymentEnvironment(): 'test' | 'production' {
    const value = this.config.get<string>('MERCADO_PAGO_ENVIRONMENT')?.trim().toLowerCase();
    if (value === 'test' || value === 'production') return value;
    throw new Error('MERCADO_PAGO_ENVIRONMENT_REQUIRED');
  }

  private payerEmailFor(environment: 'test' | 'production') {
    const value = this.config.get<string>('MERCADO_PAGO_TEST_PAYER_EMAIL')?.trim().toLowerCase();
    if (environment === 'production') {
      if (value) throw new Error('MERCADO_PAGO_TEST_PAYER_EMAIL_FORBIDDEN_IN_PRODUCTION');
      return undefined;
    }
    if (!value) throw new Error('MERCADO_PAGO_TEST_PAYER_EMAIL_REQUIRED');
    if (!/^[^\s@]+@testuser\.com$/.test(value))
      throw new Error('MERCADO_PAGO_TEST_PAYER_EMAIL_INVALID');
    return value;
  }

  private assertCreatedOrder(
    body: Record<string, unknown>,
    input: CreatePaymentInput,
    expectedSellerId: string | undefined,
    environment: 'test' | 'production',
  ) {
    const mercadoPagoOrderId = String(body.id);
    const isTestOrder = mercadoPagoOrderId.startsWith('ORDTST');
    if (environment === 'test' && !isTestOrder) throw new Error('MERCADO_PAGO_EXPECTED_TEST_ORDER');
    if (environment === 'production' && isTestOrder)
      throw new Error('MERCADO_PAGO_TEST_ORDER_FORBIDDEN_IN_PRODUCTION');
    const actualSellerId = stringValue(body.user_id);
    if (expectedSellerId && actualSellerId !== expectedSellerId)
      throw new Error('MERCADO_PAGO_ORDER_SELLER_MISMATCH');
    const actualApplicationId = stringValue(
      (body.integration_data as Record<string, unknown> | undefined)?.application_id,
    );
    if (actualApplicationId !== this.required('MERCADO_PAGO_CLIENT_ID'))
      throw new Error('MERCADO_PAGO_ORDER_APPLICATION_MISMATCH');
    if (stringValue(body.currency) !== input.currency)
      throw new Error('MERCADO_PAGO_ORDER_CURRENCY_MISMATCH');
    if (moneyToCents(body.total_amount) !== input.amountCents)
      throw new Error('MERCADO_PAGO_ORDER_AMOUNT_MISMATCH');
    if (input.clubId && moneyToCents(body.marketplace_fee) !== input.marketplaceFeeCents)
      throw new Error('MERCADO_PAGO_ORDER_MARKETPLACE_FEE_MISMATCH');
  }

  private mobileReturnUrl(input: CreatePaymentInput, result: string) {
    const scheme = this.config
      .get<string>('MOBILE_APP_SCHEME', 'beerry')
      .replace(/[^a-zA-Z0-9+.-]/g, '');
    if (!scheme) throw new Error('MOBILE_APP_SCHEME_REQUIRED');
    const query = new URLSearchParams({
      provider: 'mercado_pago',
      attemptId: input.attemptId,
      operationType: input.clubId ? 'ORDER' : 'WALLET_TOP_UP',
      operationId: input.orderId,
      result,
    });
    return `${scheme}://payments/result?${query}`;
  }
}

const mercadoPagoErrorDetails = (body: Record<string, unknown>) => ({
  message: stringValue(body.message),
  error: stringValue(body.error),
  status: body.status,
  code: body.code,
  details: body.details,
  errors: body.errors,
  cause: Array.isArray(body.cause)
    ? body.cause.slice(0, 10).map((item) => {
        if (!item || typeof item !== 'object') return String(item);
        const cause = item as Record<string, unknown>;
        return {
          code: cause.code,
          description: stringValue(cause.description),
          data: stringValue(cause.data),
        };
      })
    : undefined,
  raw: Object.keys(body).length ? body : undefined,
});

const money = (value: number) => (value / 100).toFixed(2);
const moneyToCents = (value: unknown) => Math.round(Number(value) * 100);
const stringValue = (value: unknown) =>
  typeof value === 'string' && value ? value : value == null ? undefined : String(value);
const maskEmail = (value: string) => {
  const [local, domain] = value.split('@');
  return `${local.slice(0, 4)}***@${domain}`;
};
const mapStatus = (status: string, detail: string): PaymentOutcome => {
  if (status === 'approved') return 'APPROVED';
  if (status === 'rejected') return 'REJECTED';
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'refunded') return 'REFUNDED';
  if (status === 'charged_back' || detail.includes('charged_back')) return 'CHARGEBACK';
  if (status === 'partially_refunded') return 'PARTIALLY_REFUNDED';
  return 'PENDING';
};
const mapOrderStatus = (status: string, detail: string): PaymentOutcome => {
  if (status === 'processed' && detail === 'accredited') return 'APPROVED';
  if (detail === 'partially_refunded') return 'PARTIALLY_REFUNDED';
  if (detail === 'refunded') return 'REFUNDED';
  if (status === 'cancelled' || status === 'canceled') return 'CANCELLED';
  if (status === 'expired') return 'EXPIRED';
  if (status === 'failed' || status === 'rejected') return 'REJECTED';
  return 'PENDING';
};
