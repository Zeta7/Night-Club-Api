/// <reference types="jest" />
import { LedgerService } from '../../../src/modules/wallets/application/ledger.service';

describe('Settlement ownership', () => {
  it.each(['mercado_pago', 'beerry_wallet'])(
    'separates %s from manual payables',
    async (provider) => {
      const accounts: any[] = [];
      const tx = {
        ledgerTransaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(async ({ data }) => data),
        },
        financialAccount: {
          upsert: jest.fn(async ({ create }) => {
            const account = { id: create.code, ...create };
            accounts.push(account);
            return account;
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      const service = new LedgerService({} as never, { get: () => '500' } as never);
      const sale = await service.postSale(tx as never, {
        orderId: 'order',
        paymentAttemptId: 'attempt',
        providerEventId: 'event',
        customerUserId: 'buyer',
        clubId: 'seller',
        provider,
        amountCents: 10000,
        currency: 'PEN',
        marketplaceFeeBps: 600,
        marketplaceFeeCents: 600,
      });
      const external = provider === 'mercado_pago';
      expect(accounts.find((a) => a.ownerType === 'CLUB').code).toBe(
        external ? 'CLUB_EXTERNAL:seller' : 'CLUB:seller',
      );
      expect(sale.metadata.settlementMode).toBe(external ? 'EXTERNAL_SPLIT' : 'MANUAL');
      expect(sale.metadata.providerCostCents).toBe(0);
      expect(sale.metadata.clubNetCents).toBe(9400);
      expect(sale.debitTotalCents).toBe(sale.creditTotalCents);
    },
  );
});
