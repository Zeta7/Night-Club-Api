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
        event: 'mercado_pago.preference.create.started',
        attemptId: input.attemptId,
        orderId: input.orderId,
        clubId: input.clubId ?? null,
        amountCents: input.amountCents,
        currency: input.currency,
        marketplaceFeeCents: input.marketplaceFeeCents ?? null,
        api: 'preferences',
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
    const amount = input.amountCents / 100;
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${seller.accessToken}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'x-idempotency-key': input.attemptId,
      },
      body: JSON.stringify({
        external_reference: input.attemptId,
        ...(input.clubId ? { marketplace_fee: input.marketplaceFeeCents! / 100 } : {}),
        notification_url: this.required('MERCADO_PAGO_NOTIFICATION_URL'),
        back_urls: {
          success: this.mobileReturnUrl(input, 'success'),
          pending: this.mobileReturnUrl(input, 'pending'),
          failure: this.mobileReturnUrl(input, 'failure'),
        },
        auto_return: 'approved',
        metadata: {
          attempt_id: input.attemptId,
          order_id: input.orderId,
          club_id: input.clubId ?? null,
        },
        items: [
          {
            id: input.orderId,
            title: input.subject,
            quantity: 1,
            unit_price: amount,
            currency_id: input.currency,
          },
        ],
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok || typeof body.id !== 'string') {
      this.logger.error(
        JSON.stringify({
          event: 'mercado_pago.preference.create.failed',
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
    const collectorId = stringValue(body.collector_id);
    if (seller.sellerExternalId && collectorId && collectorId !== seller.sellerExternalId)
      throw new Error('MERCADO_PAGO_PREFERENCE_SELLER_MISMATCH');
    // The official marketplace demo uses init_point for both real and test users.
    // Mercado Pago determines test mode from the credentials and accounts involved.
    const checkoutUrl = body.init_point;
    if (typeof checkoutUrl !== 'string') {
      this.logger.error(
        JSON.stringify({
          event: 'mercado_pago.preference.init_point_missing',
          attemptId: input.attemptId,
          orderId: input.orderId,
          clubId: input.clubId ?? null,
          preferenceId: body.id,
        }),
      );
      throw new Error('MERCADO_PAGO_CHECKOUT_URL_MISSING');
    }
    this.logger.log(
      JSON.stringify({
        event: 'mercado_pago.preference.create.succeeded',
        attemptId: input.attemptId,
        orderId: input.orderId,
        clubId: input.clubId ?? null,
        preferenceId: body.id,
        collectorId: collectorId ?? seller.sellerExternalId ?? null,
        sellerExternalId: seller.sellerExternalId ?? null,
        mercadoPagoRequestId: response.headers.get('x-request-id'),
        environment,
        checkoutHost: new URL(checkoutUrl).host,
      }),
    );
    return {
      externalPaymentId: body.id,
      status: 'PENDING',
      checkoutUrl,
      sellerExternalId: seller.sellerExternalId ?? collectorId,
      providerData: { preferenceId: body.id, api: 'preferences' },
    };
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
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(input.paymentId)}`,
      { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } },
    );
    const payment = (await paymentResponse.json()) as Record<string, any>;
    if (!paymentResponse.ok)
      throw new Error(`MERCADO_PAGO_QUERY_ERROR:${paymentResponse.status}`);
    const totalAmountCents = moneyToCents(payment.transaction_amount);
    const isFullRefund = input.amountCents === totalAmountCents;
    if (input.amountCents <= 0 || input.amountCents > totalAmountCents)
      throw new Error('MERCADO_PAGO_INVALID_REFUND_AMOUNT');

    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(input.paymentId)}/refunds`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
          'x-idempotency-key': input.idempotencyKey,
        },
        body: JSON.stringify(isFullRefund ? {} : { amount: input.amountCents / 100 }),
      },
    );
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok || body.id == null)
      throw new Error(`MERCADO_PAGO_REFUND_ERROR:${response.status}`);
    return {
      externalRefundId: String(body.id),
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

const moneyToCents = (value: unknown) => Math.round(Number(value) * 100);
const stringValue = (value: unknown) =>
  typeof value === 'string' && value ? value : value == null ? undefined : String(value);
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
