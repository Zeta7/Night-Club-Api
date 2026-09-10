import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference, Payment, PaymentRefund, Order } from 'mercadopago';
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
    const body = await this.sdkCall('preference.create', () =>
      new Preference(this.client(seller.accessToken)).create({
        requestOptions: { idempotencyKey: input.attemptId },
        body: {
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
            operation_type: input.operationType ?? (input.clubId ? 'ORDER' : 'WALLET_TOP_UP'),
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
        },
      }),
    );
    if (!body.id) throw new Error('MERCADO_PAGO_PREFERENCE_ID_MISSING');
    const collectorId = stringValue(body.collector_id);
    if (seller.sellerExternalId && collectorId && collectorId !== seller.sellerExternalId)
      throw new Error('MERCADO_PAGO_PREFERENCE_SELLER_MISMATCH');
    const checkoutUrl = environment === 'test' ? body.sandbox_init_point : body.init_point;
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
        mercadoPagoRequestId:
          (body.api_response?.headers as unknown as Record<string, unknown>)?.['x-request-id'] ??
          null,
        environment,
        checkoutHost: new URL(checkoutUrl).host,
        initPointHost: typeof body.init_point === 'string' ? new URL(body.init_point).host : null,
        sandboxInitPointHost:
          typeof body.sandbox_init_point === 'string'
            ? new URL(body.sandbox_init_point).host
            : null,
      }),
    );
    return {
      externalPaymentId: body.id,
      status: 'PENDING',
      checkoutUrl,
      sellerExternalId: seller.sellerExternalId ?? collectorId,
      providerData: {
        preferenceId: body.id,
        api: 'preferences',
        checkoutEnvironment: environment,
      },
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
    // A local disconnection blocks new checkouts, not refunds of previous sales.
    if (!connection || !['CONNECTED', 'DISCONNECTED'].includes(connection.status))
      throw new Error('MERCADO_PAGO_SELLER_CONNECTION_NOT_FOUND');
    const accessToken = this.cipher.decrypt(connection.accessTokenEncrypted);
    const client = this.client(accessToken);
    const payment = await this.sdkCall('payment.get', () =>
      new Payment(client).get({ id: input.paymentId }),
    );
    const totalAmountCents = moneyToCents(payment.transaction_amount);
    const isFullRefund = input.amountCents === totalAmountCents;
    if (input.amountCents <= 0 || input.amountCents > totalAmountCents)
      throw new Error('MERCADO_PAGO_INVALID_REFUND_AMOUNT');

    const body = await this.sdkCall('refund.create', () =>
      new PaymentRefund(client).create({
        payment_id: input.paymentId,
        body: isFullRefund ? {} : { amount: input.amountCents / 100 },
        requestOptions: { idempotencyKey: input.idempotencyKey },
      }),
    );
    if (body.id == null) throw new Error('MERCADO_PAGO_REFUND_ID_MISSING');
    return {
      externalRefundId: String(body.id),
      status: 'PENDING',
    };
  }

  async queryRefund(input: { paymentId: string; sellerExternalId: string; refundId: string }) {
    const connection = await this.prisma.marketplaceSellerConnection.findUniqueOrThrow({ where: { provider_externalSellerId: { provider: this.provider, externalSellerId: input.sellerExternalId } } });
    const client = this.client(this.cipher.decrypt(connection.accessTokenEncrypted));
    const refund = await this.sdkCall('refund.get', () => new PaymentRefund(client).get({ payment_id: input.paymentId, refund_id: input.refundId }));
    if (String(refund.payment_id) !== input.paymentId || String(refund.id) !== input.refundId) throw new Error('REFUND_IDENTITY_MISMATCH');
    return { id: String(refund.id), amountCents: moneyToCents(refund.amount), status: String(refund.status), payment: await this.queryPayment(input.paymentId, input.sellerExternalId) };
  }

  queryExternalPayment(externalPaymentId: string, sellerExternalId?: string) {
    return this.queryPayment(externalPaymentId, sellerExternalId ?? '');
  }

  async queryPaymentByExternalReference(externalReference: string, sellerExternalId?: string) {
    const sellerId = sellerExternalId ?? '';
    const accessToken = await this.accessTokenForSeller(sellerId);
    const search = await this.sdkCall('payment.search', () =>
      new Payment(this.client(accessToken)).search({
        options: {
          external_reference: externalReference,
          sort: 'date_last_updated',
          criteria: 'desc',
          limit: 10,
        },
      }),
    );
    const paymentId = search.results?.find(
      (payment) =>
        String(payment.external_reference ?? '') === externalReference && payment.id != null,
    )?.id;
    return paymentId ? this.queryPayment(String(paymentId), sellerId) : null;
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
    const body = (await this.sdkCall('payment.get', () =>
      new Payment(this.client(accessToken)).get({ id: paymentId }),
    )) as unknown as Record<string, any>;
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
    const attemptId = stringValue(metadata.attempt_id) ?? stringValue(body.external_reference);
    const snapshot = await this.paymentSnapshot(attemptId);
    const event: VerifiedPaymentEvent = {
      provider: this.provider,
      providerEventId: `payment:${paymentId}:${String(body.status)}:${String(body.date_last_updated ?? '')}`,
      externalPaymentId: String(body.id),
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
    const body = (await this.sdkCall('order.get', () =>
      new Order(this.client(accessToken)).get({ id: mercadoPagoOrderId }),
    )) as unknown as Record<string, any>;
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
      externalPaymentId: stringValue(payment?.id) ?? snapshot?.externalPaymentId ?? String(body.id),
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
      include: {
        order: { select: { clubId: true } },
        walletTopUp: { select: { id: true } },
        featuredCampaign: { select: { id: true } },
      },
    });
    if (!attempt) return undefined;
    return {
      externalPaymentId: attempt.externalPaymentId ?? undefined,
      operationId:
        attempt.orderId ?? attempt.walletTopUpId ?? attempt.featuredCampaignId ?? undefined,
      clubId: attempt.order?.clubId ?? undefined,
    };
  }

  private required(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value) throw new Error(`${name}_REQUIRED`);
    return value;
  }

  private client(accessToken: string) {
    return new MercadoPagoConfig({ accessToken, options: { timeout: 15000 } });
  }

  private async sdkCall<T>(operation: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      const details = error as { status?: number; code?: string };
      this.logger.error(
        JSON.stringify({
          event: `mercado_pago.${operation}.failed`,
          status: details?.status ?? null,
          code: details?.code ?? null,
        }),
      );
      throw new Error(`MERCADO_PAGO_SDK_ERROR:${operation}:${details?.status ?? 'UNKNOWN'}`);
    }
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
      operationType: input.operationType ?? (input.clubId ? 'ORDER' : 'WALLET_TOP_UP'),
      operationId: input.orderId,
      result,
    });
    return `${scheme}://payments/result?${query}`;
  }
}

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
