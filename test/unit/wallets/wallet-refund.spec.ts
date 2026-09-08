/// <reference types="jest" />
import { CommerceService } from '../../../src/modules/commerce/application/commerce.service';
import { UserRole } from '@prisma/client';

describe('Administrative wallet refunds', () => {
  function fixture() {
    const request: any = {
      id: 'refund',
      orderId: 'order',
      status: 'REQUESTED',
      requestedAmountCents: 1000,
      order: {
        clubId: 'club',
        userId: 'buyer',
        paymentAttempts: [
          {
            id: 'attempt',
            provider: 'beerry_wallet',
            status: 'APPROVED',
            amountCents: 1000,
            refundedAmountCents: 0,
            marketplaceFeeCents: 60,
          },
        ],
      },
    };
    const update = jest.fn().mockResolvedValue({});
    const tx = {
      refundRequest: {
        findUnique: jest.fn(async () => request),
        findUniqueOrThrow: jest.fn(async () => request),
        update: jest.fn(async ({ data }) => Object.assign(request, data)),
      },
      paymentAttempt: { update },
      order: { update },
      wallet: { update },
      ticket: { updateMany: update },
      consumableRight: { updateMany: update },
      productDelivery: { updateMany: update },
      auditLogEntry: { create: update },
    };
    const prisma = { ...tx, $transaction: jest.fn(async (action) => action(tx)) };
    const ledger = { reverseSale: jest.fn().mockResolvedValue({}) };
    const referrals = { reverseOrderEffects: jest.fn().mockResolvedValue(undefined) };
    const gateway = { createRefund: jest.fn() };
    const service = new CommerceService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
      ledger as never,
      undefined,
      referrals as never,
      undefined,
      undefined,
      gateway as never,
    );
    return { service, ledger, referrals, gateway };
  }
  const admin = { id: 'admin', role: UserRole.SUPER_ADMIN };
  it('restores once and does not send a wallet refund to Mercado Pago', async () => {
    const f = fixture();
    await f.service.processRefundRequest(admin, 'refund');
    await f.service.processRefundRequest(admin, 'refund');
    expect(f.referrals.reverseOrderEffects).toHaveBeenCalledTimes(1);
    expect(f.ledger.reverseSale).toHaveBeenCalledTimes(1);
    expect(f.gateway.createRefund).not.toHaveBeenCalled();
  });
  it('does not restore the entire balance for a partial refund', async () => {
    const f = fixture();
    await expect(f.service.processRefundRequest(admin, 'refund', 500)).rejects.toThrow();
    expect(f.referrals.reverseOrderEffects).not.toHaveBeenCalled();
    expect(f.ledger.reverseSale).not.toHaveBeenCalled();
  });
});
