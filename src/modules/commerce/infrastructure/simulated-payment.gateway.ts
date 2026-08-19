import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentGateway,
  PaymentOutcome,
  VerifiedPaymentEvent,
} from '../application/ports/payment-gateway.port';

@Injectable()
export class SimulatedPaymentGateway implements PaymentGateway {
  readonly provider = 'simulated';

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      externalPaymentId: `sim_pay_${input.attemptId}`,
      status: 'PENDING',
      providerData: { simulator: true, orderId: input.orderId },
    };
  }

  createSimulatedEvent(externalPaymentId: string, outcome: PaymentOutcome): VerifiedPaymentEvent {
    return {
      provider: this.provider,
      providerEventId: `sim_evt_${randomUUID()}`,
      externalPaymentId,
      outcome,
      failureCode: outcome === 'REJECTED' ? 'SIMULATED_REJECTION' : undefined,
      failureMessage: outcome === 'REJECTED' ? 'El pago fue rechazado por el simulador.' : undefined,
      payload: { simulator: true, outcome },
    };
  }
}
