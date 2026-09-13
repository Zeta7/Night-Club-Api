/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { CommerceItemType, EventStatus, UserRole } from '@prisma/client';
import { ClubsService } from '../../../src/modules/clubs/application/clubs.service';
import { CommerceService } from '../../../src/modules/commerce/application/commerce.service';
import { EventsService } from '../../../src/modules/events/application/events.service';
import { PromotionsService } from '../../../src/modules/promotions/application/promotions.service';
import { TicketsService } from '../../../src/modules/tickets/application/tickets.service';
import { currentPromotionsWhere } from '../../../src/modules/promotions/application/promotion-availability';

const user = { id: 'admin', role: UserRole.SUPER_ADMIN };
const now = new Date('2026-09-12T12:00:00Z');

describe('Lifecycle read models and activation', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(now); });
  afterEach(() => jest.useRealTimers());

  it('active promotion queries inherit their event end and publication state', () => {
    expect(currentPromotionsWhere(now)).toEqual({ status: 'ACTIVE', AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      { OR: [{ eventId: null }, { event: { status: { in: ['PUBLISHED', 'SALE_ACTIVE', 'SOLD_OUT', 'IN_PROGRESS'] }, endsAt: { gt: now } } }] },
    ] });
  });

  it('excludes old events before the overview six-event limit', async () => {
    const prisma = { club: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new ClubsService(prisma as never, new ConfigService(), {} as never, {} as never);
    await service.getAdminDashboard(user);
    expect(prisma.club.findFirst.mock.calls[0][0].include.events).toEqual(expect.objectContaining({
      take: 6, where: { status: { in: ['PUBLISHED', 'SALE_ACTIVE', 'SOLD_OUT', 'IN_PROGRESS'] }, endsAt: { gt: now } },
    }));
  });

  it('public events require Mercado Pago and exclude past events', async () => {
    const prisma = { event: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new EventsService(prisma as never, {} as never, new ConfigService());
    await service.listPublicEvents();
    expect(prisma.event.findMany.mock.calls[0][0].where).toEqual({
      status: { in: ['PUBLISHED', 'SALE_ACTIVE', 'SOLD_OUT', 'IN_PROGRESS'] },
      endsAt: { gt: now }, club: { status: 'ACTIVE', sellerConnections: { some: { provider: 'mercado_pago', status: 'CONNECTED', OR: [{ tokenExpiresAt: null }, { tokenExpiresAt: { gt: now } }] } } },
    });
  });

  it.each([CommerceItemType.TICKET, CommerceItemType.PROMOTION])('rejects expired-event %s before adding it to the cart', async (type) => {
    const source = { id: 'item', clubId: 'club', name: 'Offer', status: 'ACTIVE',
      eventId: 'event', event: { status: EventStatus.SALE_ACTIVE, endsAt: now },
      quantityTotal: 10, quantitySold: 0, priceCents: 100, finalPriceCents: 100,
      club: { name: 'Club', status: 'ACTIVE', sellerConnections: [] } };
    const prisma = {
      ticketType: { findUnique: jest.fn().mockResolvedValue(source) },
      promotion: { findUnique: jest.fn().mockResolvedValue(source) },
      inventoryReservation: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }) },
      $transaction: jest.fn(),
    };
    const service = new CommerceService(prisma as never, new ConfigService(), {} as never, { provider: 'simulated' } as never);
    await expect(service.addCartItem({ id: 'buyer', role: UserRole.CUSTOMER }, { type, id: 'item', quantity: 1 }))
      .rejects.toMatchObject({ response: { error: { code: 'CART_ITEM_UNAVAILABLE' } } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not activate a promotion whose event has ended', async () => {
    const prisma = {
      club: { findUnique: jest.fn().mockResolvedValue({ id: 'club' }) },
      promotion: { findFirst: jest.fn().mockResolvedValue({ endsAt: null, event: { status: 'PUBLISHED', endsAt: now } }), update: jest.fn() },
    };
    const service = new PromotionsService(prisma as never, {} as never, new ConfigService());
    await expect(service.activatePromotion(user, 'club', 'promo'))
      .rejects.toMatchObject({ response: { error: { code: 'PROMOTION_EXPIRED' } } });
    expect(prisma.promotion.update).not.toHaveBeenCalled();
  });

  it.each([null, { status: EventStatus.PUBLISHED, endsAt: now }])('does not activate tickets after their own or parent end', async (event) => {
    const prisma = {
      club: { findUnique: jest.fn().mockResolvedValue({ id: 'club' }) },
      event: { findFirst: jest.fn().mockResolvedValue({ id: 'event' }) },
      ticketType: { findFirst: jest.fn().mockResolvedValue({ saleEndAt: event ? null : now, event }), update: jest.fn() },
    };
    const service = new TicketsService(prisma as never);
    const action = event ? service.activateEventTicketType(user, 'club', 'event', 'ticket') : service.activateTicketType(user, 'club', 'ticket');
    await expect(action).rejects.toMatchObject({ response: { error: { code: 'TICKET_SALE_ENDED' } } });
    expect(prisma.ticketType.update).not.toHaveBeenCalled();
  });

  it('editing stock preserves an inactive ticket and a partial date update preserves the other end', async () => {
    const startsAt = new Date('2026-09-10');
    const prisma = {
      club: { findUnique: jest.fn().mockResolvedValue({ id: 'club' }) },
      ticketType: {
        findFirst: jest.fn().mockResolvedValue({ quantitySold: 1, replacementReserved: 0, status: 'INACTIVE', saleStartAt: startsAt, saleEndAt: new Date('2099-01-01') }),
        update: jest.fn().mockRejectedValue(new Error('reached-write')),
      },
    };
    const service = new TicketsService(prisma as never);
    await expect(service.updateTicketType(user, 'club', 'ticket', { quantityTotal: 20, saleEndAt: '2026-09-15T00:00:00Z' }))
      .rejects.toThrow('reached-write');
    expect(prisma.ticketType.update.mock.calls[0][0].data).toEqual({ quantityTotal: 20, status: 'INACTIVE', saleEndAt: new Date('2026-09-15') });
    prisma.ticketType.update.mockClear();
    await expect(service.updateTicketType(user, 'club', 'ticket', { saleEndAt: '2026-09-01T00:00:00Z' }))
      .rejects.toMatchObject({ response: { error: { code: 'TICKET_SALE_RANGE_INVALID' } } });
    expect(prisma.ticketType.update).not.toHaveBeenCalled();
  });
});
