/// <reference types="jest" />
import { ReferralsService } from '../../../src/modules/referrals/application/referrals.service';

describe('cumulative wallet restoration', () => {
  function fixture(expired = false) {
    const rows = [333, 667].map((amountCents, index) => ({ id: String(index), creditLotId: String(index), amountCents, restoredCents: 0,
      creditLot: { walletId: 'wallet', remainingAmountCents: 0, originalAmountCents: amountCents, status: 'USED', expiresAt: expired && index === 0 ? new Date('2000-01-01') : null } }));
    const tx = { order: { findUniqueOrThrow: jest.fn().mockResolvedValue({ userId: 'buyer' }) }, $queryRaw: jest.fn(),
      walletCreditConsumption: { findMany: jest.fn(async () => rows), update: jest.fn(async ({ where, data }) => Object.assign(rows[Number(where.id)], data)) },
      walletCreditLot: { update: jest.fn(async ({ where, data }) => Object.assign(rows[Number(where.id)].creditLot, data)) },
      wallet: { update: jest.fn() }, walletMovement: { create: jest.fn() },
    };
    const service = Object.create(ReferralsService.prototype) as ReferralsService;
    return { rows, tx, restore: (amount: number) => service.restoreOrderCredits(tx as never, 'order', amount, 1000) };
  }
  it('allocates exact cents and cannot restore the same cumulative refund twice', async () => {
    const { rows, tx, restore } = fixture();
    await restore(500); expect(rows.map((row) => row.restoredCents)).toEqual([166,334]);
    await restore(500); expect(tx.wallet.update).toHaveBeenCalledTimes(2);
    await restore(1000); expect(rows.map((row) => row.restoredCents)).toEqual([333,667]);
    expect(rows.reduce((sum, row) => sum + row.creditLot.remainingAmountCents, 0)).toBe(1000);
  });
  it('keeps original expiration and does not revive expired rewards', async () => {
    const { rows, tx, restore } = fixture(true); await restore(1000);
    expect(rows[0].restoredCents).toBe(333); expect(rows[0].creditLot.remainingAmountCents).toBe(0);
    expect(rows[0].creditLot.expiresAt).toEqual(new Date('2000-01-01'));
    expect(tx.wallet.update).toHaveBeenCalledTimes(1);
  });
});
