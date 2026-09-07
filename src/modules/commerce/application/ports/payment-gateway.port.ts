export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
export const WALLET_TOP_UP_PAYMENT_GATEWAY = Symbol('WALLET_TOP_UP_PAYMENT_GATEWAY');
export const REFUND_GATEWAY = Symbol('REFUND_GATEWAY');

export type PaymentOutcome =
  | 'APPROVED'
  | 'REJECTED'
  | 'PENDING'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'CHARGEBACK';

export type CreatePaymentInput = {
  attemptId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  payerEmail?: string;
  subject: string;
  clubId?: string;
  marketplaceFeeCents?: number;
  sellerExternalId?: string;
};

export type CreatePaymentResult = {
  externalPaymentId: string;
  status: 'PENDING';
  checkoutUrl?: string;
  providerData?: Record<string, unknown>;
  sellerExternalId?: string;
};

export type VerifiedPaymentEvent = {
  provider: string;
  providerEventId: string;
  externalPaymentId: string;
  outcome: PaymentOutcome;
  failureCode?: string;
  failureMessage?: string;
  payload?: Record<string, unknown>;
  attemptId?: string;
  orderId?: string;
  clubId?: string;
  amountCents?: number;
  currency?: string;
  sellerExternalId?: string;
  marketplaceFeeCents?: number;
  refundedAmountCents?: number;
};

export type CreateRefundInput = {
  paymentId: string;
  sellerExternalId: string;
  amountCents: number;
  idempotencyKey: string;
};

export type CreateRefundResult = {
  externalRefundId: string;
  status: 'PENDING';
};

export interface PaymentGateway {
  readonly provider: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPaymentToken?(token: string): Promise<VerifiedPaymentEvent>;
  createSimulatedEvent?(externalPaymentId: string, outcome: PaymentOutcome): VerifiedPaymentEvent;
}

export interface RefundGateway {
  readonly provider: string;
  createRefund(input: CreateRefundInput): Promise<CreateRefundResult>;
}
