/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { FlowPaymentsController } from '@modules/commerce/presentation/flow-payments.controller';

describe('FlowPaymentsController mobile return', () => {
  const event = {
    provider: 'flow',
    providerEventId: 'flow:123:2',
    externalPaymentId: 'flow-token',
    outcome: 'APPROVED' as const,
  };
  const flow = { verifyPaymentToken: jest.fn().mockResolvedValue(event) };
  const commerce = {
    processPaymentEvent: jest.fn().mockResolvedValue(undefined),
    getPaymentReturnContext: jest.fn().mockResolvedValue({
      provider: 'flow',
      attemptId: 'attempt-1',
      operationType: 'WALLET_TOP_UP',
      operationId: 'topup-1',
    }),
  };
  const config = new ConfigService({ MOBILE_ANDROID_PACKAGE: 'com.beerry.app' });
  const controller = new FlowPaymentsController(flow as never, commerce as never, config);

  it('verifies Flow and emits Android intent plus custom-scheme fallback', async () => {
    const html = await controller.returnPost('flow-token');

    expect(flow.verifyPaymentToken).toHaveBeenCalledWith('flow-token');
    expect(commerce.processPaymentEvent).toHaveBeenCalledWith(event);
    expect(html).toContain('beerry://payments/result?');
    expect(html).toContain('intent://payments/result?');
    expect(html).toContain('package=com.beerry.app');
    expect(html).toContain('operationId=topup-1');
    expect(html).not.toContain('flow-token');
  });
});
