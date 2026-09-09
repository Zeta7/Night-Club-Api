/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { MarketplaceFeeService } from '../../../src/modules/platform/application/marketplace-fee.service';

describe('MarketplaceFeeService', () => {
  const config = { get: (_key: string, fallback: string) => fallback } as ConfigService;
  const audit = { record: jest.fn() } as any;

  it.each([
    [10000, 0, 0],
    [10000, 500, 500],
    [2, 3000, 1],
    [101, 500, 5],
  ])('rounds %i cents at %i bps to %i cents', (amount, bps, expected) => {
    const service = new MarketplaceFeeService({} as any, config, audit);
    expect(service.calculate(amount, bps)).toBe(expected);
  });

  it('uses a business override and returns an immutable snapshot', async () => {
    const prisma = {
      club: { findUnique: jest.fn().mockResolvedValue({ marketplaceFeeBps: 750 }) },
    } as any;
    const service = new MarketplaceFeeService(prisma, config, audit);
    jest.spyOn(service, 'readGlobal').mockResolvedValue({
      defaultMarketplaceFeeBps: 500,
      source: 'BPS',
      maximumMarketplaceFeeBps: 3000,
    });
    await expect(service.resolve('club', 10001)).resolves.toEqual({
      marketplaceFeeBps: 750,
      marketplaceFeeCents: 750,
      sellerExpectedNetCents: 9251,
      feeSource: 'BUSINESS_OVERRIDE',
    });
  });

  it('inherits the legacy percentage when BPS is absent', async () => {
    const prisma = {
      platformSettings: {
        findUnique: jest.fn().mockResolvedValue({ settingsJson: '{"commissionPercentage":6}' }),
      },
    } as any;
    const service = new MarketplaceFeeService(prisma, config, audit);
    await expect(service.readGlobal()).resolves.toMatchObject({
      defaultMarketplaceFeeBps: 600,
      source: 'LEGACY_PERCENTAGE',
    });
  });

  it.each([-1, 3001, 1.5])('rejects an invalid fee %p', (fee) => {
    const service = new MarketplaceFeeService({} as any, config, audit);
    expect(() => service.calculate(1000, fee)).toThrow();
  });
});
