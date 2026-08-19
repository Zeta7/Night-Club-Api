export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type PaymentOutcome =
  'APPROVED' | 'REJECTED' | 'PENDING' | 'EXPIRED' | 'REFUNDED' | 'CHARGEBACK';

export type CreatePaymentInput = {
  attemptId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  payerEmail: string;
  subject: string;
};

export type CreatePaymentResult = {
  externalPaymentId: string;
  status: 'PENDING';
  checkoutUrl?: string;
  providerData?: Record<string, unknown>;
};

export type VerifiedPaymentEvent = {
  provider: string;
  providerEventId: string;
  externalPaymentId: string;
  outcome: PaymentOutcome;
  failureCode?: string;
  failureMessage?: string;
  payload?: Record<string, unknown>;
};

export interface PaymentGateway {
  readonly provider: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPaymentToken?(token: string): Promise<VerifiedPaymentEvent>;
  createSimulatedEvent?(externalPaymentId: string, outcome: PaymentOutcome): VerifiedPaymentEvent;
}
