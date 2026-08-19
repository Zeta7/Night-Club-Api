/// <reference types="jest" />
import { SimulatedPaymentGateway } from './simulated-payment.gateway';

describe('SimulatedPaymentGateway', () => {
  const gateway = new SimulatedPaymentGateway();

  it('creates a pending provider payment without approving the order implicitly', async () => {
    const result = await gateway.createPayment({
      attemptId: 'attempt-1',
      orderId: 'order-1',
      amountCents: 1250,
      currency: 'PEN',
      payerEmail: 'cliente@beerry.test',
      subject: 'Compra Beerry',
    });

    expect(result).toMatchObject({
      externalPaymentId: 'sim_pay_attempt-1',
      status: 'PENDING',
    });
  });

  it.each(['APPROVED', 'REJECTED', 'PENDING', 'EXPIRED'] as const)(
    'creates a verifiable %s event',
    (outcome) => {
      const event = gateway.createSimulatedEvent('sim_pay_attempt-1', outcome);

      expect(event.provider).toBe('simulated');
      expect(event.externalPaymentId).toBe('sim_pay_attempt-1');
      expect(event.outcome).toBe(outcome);
      expect(event.providerEventId).toMatch(/^sim_evt_/);
    },
  );
});
