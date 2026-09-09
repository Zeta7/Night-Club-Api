/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { CommerceItemType, EventStatus, UserRole } from '@prisma/client';
import { CommerceService } from '../../../src/modules/commerce/application/commerce.service';

describe('Event checkout availability', () => {
  function fixture(type: CommerceItemType, status: EventStatus | null) {
    const source = {
      id: 'item',
      clubId: 'club',
      club: { name: 'Club' },
      eventId: status === null ? null : 'event',
      event: status === null ? null : { status },
      priceCents: 1000,
      finalPriceCents: 1000,
      quantityTotal: 10,
      quantitySold: 0,
    };
    const tx = {
      cart: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ items: [{ itemId: 'item', itemType: type, quantity: 1 }] }),
      },
      ticketType: { findFirst: jest.fn().mockResolvedValue(source) },
      promotion: { findFirst: jest.fn().mockResolvedValue(source) },
      inventoryReservation: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      order: { create: jest.fn() },
    };
    const prisma = { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
    const gateway = { provider: 'simulated' };
    const service = new CommerceService(
      prisma as never,
      new ConfigService(),
      {} as never,
      gateway as never,
    );
    const checkout = () =>
      service.checkout({ id: 'user', role: UserRole.CUSTOMER }, { expectedTotalCents: 999 });
    return { checkout, tx };
  }

  for (const type of [CommerceItemType.TICKET, CommerceItemType.PROMOTION]) {
    it.each([
      EventStatus.PUBLISHED,
      EventStatus.CANCELLED,
      EventStatus.POSTPONED,
      EventStatus.SOLD_OUT,
      EventStatus.IN_PROGRESS,
      EventStatus.FINISHED,
    ])(`${type}: rejects a cart item when its event changed to %s`, async (status) => {
      const f = fixture(type, status);
      await expect(f.checkout()).rejects.toMatchObject({
        response: { error: { code: `${type}_UNAVAILABLE` } },
      });
      expect(f.tx.order.create).not.toHaveBeenCalled();
    });
    it.each([EventStatus.SALE_ACTIVE, null])(
      `${type}: permits sale state %s through to price validation`,
      async (status) => {
        const f = fixture(type, status);
        await expect(f.checkout()).rejects.toMatchObject({
          response: { error: { code: 'CART_TOTAL_CHANGED' } },
        });
      },
    );
  }
});
