/// <reference types="jest" />
import { WalletsService } from '../../../src/modules/wallets/application/wallets.service';
import { UserRole } from '@prisma/client';

describe('Private operation details', () => {
  const user = { id: 'buyer', role: UserRole.CUSTOMER };
  it('filters orders by the authenticated buyer and rejects missing orders', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new WalletsService({ order: { findFirst } } as never, {} as never);
    await expect(service.orderDetail(user, 'another-order')).rejects.toThrow();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'another-order', userId: 'buyer' } }));
  });
  it('filters movements by wallet owner', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new WalletsService({ walletMovement: { findFirst } } as never, {} as never);
    await expect(service.movementDetail(user, 'movement')).rejects.toThrow();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'movement', wallet: { userId: 'buyer' } } }));
  });
  it('returns purchased item snapshots, not current catalog prices', async () => {
    const items = [{ nameSnapshot: 'Entrada general', quantity: 2, unitPriceCents: 2500, totalCents: 5000, itemType: 'TICKET' }];
    const service = new WalletsService({ event: { findMany: jest.fn().mockResolvedValue([]) }, eventCancellation: { findMany: jest.fn().mockResolvedValue([]) }, order: { findFirst: jest.fn().mockResolvedValue({ id: 'order', club: { name: 'Club' }, items, totalCents: 5000 }) } } as never, {} as never);
    expect(await service.orderDetail(user, 'order')).toEqual(expect.objectContaining({ amountCents: 5000, business: 'Club', items: items.map((item) => ({ ...item, replacementRefundStatus: null, refundExecution: null, replacementOffer: null, canRequestReplacementRefund: false })) }));
  });
});
