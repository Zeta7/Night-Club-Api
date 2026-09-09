/// <reference types="jest" />
import { CommerceService } from '../../../src/modules/commerce/application/commerce.service';

describe('payment approved after event cancellation', () => {
  it('records paid rights as cancelled under the event lock, without refunding money', async () => {
    const event = { status: 'CANCELLED', startsAt: new Date(), endsAt: new Date() };
    const tx = {
      $queryRaw: jest.fn(), event: { findUniqueOrThrow: jest.fn().mockResolvedValue(event) },
      ticketType: { findUnique: jest.fn().mockResolvedValue({ eventId: 'event', event }) },
      promotion: { findUnique: jest.fn().mockResolvedValue({ eventId: 'event', event }) },
      ticket: { create: jest.fn() }, consumableRight: { create: jest.fn() },
      notification: { create: jest.fn() }, auditLogEntry: { create: jest.fn() },
    };
    const service = new CommerceService({} as never, {} as never, {} as never, {} as never);
    jest.spyOn(service as any, 'qr').mockReturnValue('signed');
    jest.spyOn(service as any, 'activeSigningVersion').mockReturnValue('v1');
    await (service as any).issueOrderResources(tx, { id: 'order', userId: 'buyer', combineProducts: false, items: [
      { id: 'line1', eventId: 'event', clubId: 'club', itemId: 'ticket', itemType: 'TICKET', quantity: 1 },
      { id: 'line2', eventId: 'event', clubId: 'club', itemId: 'promo', itemType: 'PROMOTION', quantity: 1 },
    ] });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    for (const create of [tx.ticket.create, tx.consumableRight.create]) {
      expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventId: 'event', status: 'CANCELLED', revokedReason: 'EVENT_CANCELLED:event' }) });
    }
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLogEntry.create).toHaveBeenCalledTimes(1);
  });
});
