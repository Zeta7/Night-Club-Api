/// <reference types="jest" />
import { EventStatus, UserRole } from '@prisma/client';
import { EventsService } from '../../../src/modules/events/application/events.service';

describe('Event transition protection', () => {
  const user = { id: 'admin', role: UserRole.SUPER_ADMIN };
  function fixture(status: EventStatus, lockedStatus = status, hasPurchases = false) {
    const event = { id: 'event', clubId: 'club', status, endsAt: new Date('2099-01-01'), imageUrl: null };
    const tx = {
      club: { findFirst: jest.fn().mockResolvedValue({ id: 'club' }) },
      eventCancellation: { findUnique: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      event: { findUniqueOrThrow: jest.fn().mockResolvedValue({ ...event, status: lockedStatus }), update: jest.fn().mockResolvedValue(event) },
      ticketType: { findMany: jest.fn().mockResolvedValue([]) },
      promotion: { findMany: jest.fn().mockResolvedValue([]) },
      ticket: { findFirst: jest.fn().mockResolvedValue(hasPurchases ? { id: 'ticket' } : null), updateMany: jest.fn() },
      consumableRight: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn() },
      orderItem: { findFirst: jest.fn().mockResolvedValue(null) },
      auditLogEntry: { create: jest.fn() },
    };
    const prisma = { club: { findUnique: jest.fn().mockResolvedValue({ id: 'club' }) }, event: { findFirst: jest.fn().mockResolvedValue(event) }, $transaction: (fn: (arg: typeof tx) => unknown) => fn(tx) };
    const service = new EventsService(prisma as never, { createReadableImageUrl: jest.fn() } as never, {} as never);
    return { service, tx };
  }
  it('does not overwrite a concurrent status change', async () => {
    const { service, tx } = fixture(EventStatus.PUBLISHED, EventStatus.CANCELLED);
    await expect(service.startSale(user, 'club', 'event')).rejects.toThrow();
    expect(tx.event.update).not.toHaveBeenCalled();
  });
  it('does not reactivate previously issued rights', async () => {
    const { service, tx } = fixture(EventStatus.CANCELLED, EventStatus.CANCELLED, true);
    await expect(service.reactivateEvent(user, 'club', 'event')).rejects.toThrow();
    expect(tx.event.update).not.toHaveBeenCalled();
  });
  it.each([EventStatus.DRAFT, EventStatus.PUBLISHED])('requires a payment-ready club to publish or start sales from %s', async (status) => {
    const { service, tx } = fixture(status);
    tx.club.findFirst.mockResolvedValue(null as never);
    await expect(status === EventStatus.DRAFT ? service.publishEvent(user, 'club', 'event') : service.startSale(user, 'club', 'event')).rejects.toMatchObject({ response: { error: { code: 'EVENT_PAYMENTS_NOT_READY' } } });
    expect(tx.event.update).not.toHaveBeenCalled();
  });
  it('publishing requires the same seller connection that makes the catalogue visible', async () => {
    const { service, tx } = fixture(EventStatus.DRAFT);
    // Stop after the guarded write: response hydration is independent of eligibility.
    tx.event.update.mockRejectedValue(new Error('reached-write'));
    await expect(service.publishEvent(user, 'club', 'event')).rejects.toThrow('reached-write');
    expect(tx.club.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ id: 'club', status: 'ACTIVE', sellerConnections: expect.any(Object) }), select: { id: true } });
    expect(tx.event.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'PUBLISHED' } }));
  });

});
