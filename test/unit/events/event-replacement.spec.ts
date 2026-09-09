/// <reference types="jest" />
import { UserRole } from '@prisma/client';
import { EventReplacementService } from '../../../src/modules/commerce/application/event-replacement.service';

describe('event replacement acceptance', () => {
  const startsAt = new Date('2099-01-01'), endsAt = new Date('2099-01-02');
  function fixture() {
    const item = { id: 'line', orderId: 'order', eventId: 'old', itemId: 'old-ticket', itemType: 'TICKET', clubId: 'club', quantity: 2, order: { status: 'PAID' } };
    const tx = {
      $queryRaw: jest.fn(), orderItem: { findFirst: jest.fn().mockResolvedValue(item), findUniqueOrThrow: jest.fn().mockResolvedValue(item), update: jest.fn() },
      eventCancellation: { findUniqueOrThrow: jest.fn().mockResolvedValue({ eventId: 'old', replacementEventId: 'new', status: 'REPLACEMENT_PROPOSED' }) },
      eventReplacementAcceptance: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      eventBuyerRefundRequest: { findUnique: jest.fn().mockResolvedValue(null) }, refundRequest: { findFirst: jest.fn().mockResolvedValue(null) },
      eventReplacementMapping: { findUnique: jest.fn().mockResolvedValue({ id: 'map', targetItemId: 'target' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      event: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'new', status: 'PUBLISHED', startsAt, endsAt }) },
      ticket: { findFirst: jest.fn().mockResolvedValue(null) }, consumableRight: { findFirst: jest.fn().mockResolvedValue(null) },
      ticketType: { update: jest.fn() }, auditLogEntry: { create: jest.fn() }, notification: { create: jest.fn() },
    };
    const commerce = { issueReplacementResources: jest.fn() };
    const service = new EventReplacementService({ $transaction: (fn: (tx: any) => unknown) => fn(tx) } as never, {} as never, commerce as never);
    const accept = () => service.accept({ id: 'buyer', role: UserRole.CUSTOMER }, 'line', 'case', startsAt.toISOString(), endsAt.toISOString());
    return { tx, commerce, accept };
  }
  it('exchanges reserved capacity for sold capacity without creating a payment', async () => {
    const { tx, commerce, accept } = fixture();
    await accept();
    expect(tx.ticketType.update).toHaveBeenCalledWith({ where: { id: 'target' }, data: { replacementReserved: { decrement: 2 }, quantitySold: { increment: 2 } } });
    expect(commerce.issueReplacementResources).toHaveBeenCalledWith(tx, 'line', 'target', 'new');
    expect(tx.eventReplacementAcceptance.create).toHaveBeenCalledTimes(1);
  });
  it('is idempotent after acceptance', async () => {
    const { tx, commerce, accept } = fixture(); tx.eventReplacementAcceptance.findUnique.mockResolvedValue({ id: 'accepted' });
    await accept(); expect(commerce.issueReplacementResources).not.toHaveBeenCalled();
  });
  it('refuses acceptance once the buyer requested a refund', async () => {
    const { tx, commerce, accept } = fixture(); tx.eventBuyerRefundRequest.findUnique.mockResolvedValue({ id: 'refund' });
    await expect(accept()).rejects.toThrow(); expect(commerce.issueReplacementResources).not.toHaveBeenCalled();
  });
  it('requires new consent when the dates changed', async () => {
    const { tx, commerce, accept } = fixture(); tx.event.findUniqueOrThrow.mockResolvedValue({ id: 'new', status: 'PUBLISHED', startsAt: new Date('2099-02-01'), endsAt });
    await expect(accept()).rejects.toThrow(); expect(commerce.issueReplacementResources).not.toHaveBeenCalled();
  });
  it('does not transfer used purchases or overdraw a capacity reservation', async () => {
    const first = fixture(); first.tx.ticket.findFirst.mockResolvedValue({ id: 'used' });
    await expect(first.accept()).rejects.toThrow();
    const second = fixture(); second.tx.eventReplacementMapping.updateMany.mockResolvedValue({ count: 0 });
    await expect(second.accept()).rejects.toThrow(); expect(second.commerce.issueReplacementResources).not.toHaveBeenCalled();
  });
});
