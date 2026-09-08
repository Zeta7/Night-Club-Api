/// <reference types="jest" />
import { SellerConnectionService } from '../../../src/modules/payments/application/seller-connection.service';
import { UserRole } from '@prisma/client';

describe('Club wallet acceptance', () => {
  function fixture(admin: boolean) {
    const prisma = {
      club: {
        findUnique: jest.fn().mockResolvedValue({ id: 'club', acceptsWalletPayments: false }),
        update: jest.fn().mockResolvedValue({}),
      },
      clubAdmin: { findUnique: jest.fn().mockResolvedValue(admin ? { id: 'admin' } : null) },
    };
    const service = new SellerConnectionService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      { record: jest.fn() } as never,
    );
    return { service, prisma };
  }
  it('returns disabled for a club with default settings', async () => {
    expect(await fixture(false).service.walletAcceptance('club')).toEqual({ enabled: false });
  });
  it('allows the administrator to enable wallet payments', async () => {
    const f = fixture(true);
    expect(
      await f.service.setWalletAcceptance({ id: 'admin', role: UserRole.ADMIN }, 'club', true),
    ).toEqual({ enabled: true });
    expect(f.prisma.club.update).toHaveBeenCalledWith({
      where: { id: 'club' },
      data: { acceptsWalletPayments: true },
    });
  });
  it('rejects an unrelated user without changing settings', async () => {
    const f = fixture(false);
    await expect(
      f.service.setWalletAcceptance({ id: 'other', role: UserRole.CUSTOMER }, 'club', true),
    ).rejects.toThrow();
    expect(f.prisma.club.update).not.toHaveBeenCalled();
  });
});
