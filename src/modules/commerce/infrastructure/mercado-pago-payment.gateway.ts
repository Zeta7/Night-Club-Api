import { Injectable } from '@nestjs/common';
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
  constructor(
    private readonly config: ConfigService,
    private readonly connections: SellerConnectionService,
    private readonly prisma: PrismaService,
    private readonly cipher: SellerCredentialCipher,
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
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
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${seller.accessToken}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'x-idempotency-key': input.attemptId,
      },
      body: JSON.stringify({
        items: [
          {
            id: input.orderId,
            title: input.subject,
            currency_id: input.currency,
            quantity: 1,
            unit_price: cents(input.amountCents),
          },
        ],
        ...(input.payerEmail ? { payer: { email: input.payerEmail } } : {}),
        ...(input.clubId ? { marketplace_fee: cents(input.marketplaceFeeCents!) } : {}),
        external_reference: input.attemptId,
        metadata: { attempt_id: input.attemptId, order_id: input.orderId, club_id: input.clubId },
        back_urls: {
          success: this.required('MERCADO_PAGO_RETURN_URL'),
          pending: this.required('MERCADO_PAGO_RETURN_URL'),
          failure: this.required('MERCADO_PAGO_RETURN_URL'),
        },
        notification_url: this.required('MERCADO_PAGO_NOTIFICATION_URL'),
        auto_return: 'approved',
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok || typeof body.id !== 'string')
      throw new Error(`MERCADO_PAGO_CREATE_ERROR:${response.status}`);
    const checkoutUrl =
      this.config.get<string>('MERCADO_PAGO_USE_SANDBOX_CHECKOUT', 'false') === 'true'
        ? body.sandbox_init_point
        : body.init_point;
    if (typeof checkoutUrl !== 'string') throw new Error('MERCADO_PAGO_CHECKOUT_URL_MISSING');
    return {
      externalPaymentId: body.id,
      status: 'PENDING',
      checkoutUrl,
      sellerExternalId: seller.sellerExternalId ?? stringValue(body.collector_id),
      providerData: { preferenceId: body.id },
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
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(input.paymentId)}/refunds`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.cipher.decrypt(connection.accessTokenEncrypted)}`,
          'content-type': 'application/json',
          accept: 'application/json',
          'x-idempotency-key': input.idempotencyKey,
        },
        body: JSON.stringify({ amount: cents(input.amountCents) }),
      },
    );
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok || body.id == null)
      throw new Error(`MERCADO_PAGO_REFUND_ERROR:${response.status}`);
    return { externalRefundId: String(body.id), status: 'PENDING' };
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
    if (!response.ok) throw new Error(`MERCADO_PAGO_QUERY_ERROR:${response.status}`);
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
    const attemptId = stringValue(metadata.attempt_id) ?? stringValue(body.external_reference);
    return {
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
      orderId: stringValue(metadata.order_id),
      clubId: stringValue(metadata.club_id),
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
  }

  private required(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value) throw new Error(`${name}_REQUIRED`);
    return value;
  }
}

const cents = (value: number) => Number((value / 100).toFixed(2));
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
