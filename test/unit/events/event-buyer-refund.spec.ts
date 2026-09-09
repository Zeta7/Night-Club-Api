/// <reference types="jest" />
import { UserRole } from '@prisma/client';
import { EventsService } from '../../../src/modules/events/application/events.service';

describe('individual replacement refund consent', () => {
  const buyer = { id: 'buyer', role: UserRole.CUSTOMER };
  const admin = { id: 'admin', role: UserRole.ADMIN };
  const beerry = { id: 'beerry', role: UserRole.SUPER_ADMIN };
  function fixture(status = 'PENDING_BUSINESS') {
    const tx = {
      $queryRaw: jest.fn(),
      orderItem: { findFirst: jest.fn().mockResolvedValue({ id: 'item', eventId: 'event', orderId: 'order', clubId: 'club' }) },
      order: { findUniqueOrThrow: jest.fn().mockResolvedValue({ status: 'PAID', userId: 'buyer' }) },
      eventCancellation: { findUnique: jest.fn().mockResolvedValue({ id: 'case', mode: 'REPLACEMENT', status: 'REPLACEMENT_PROPOSED' }) },
      eventBuyerRefundRequest: {
        findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'request', status: 'PENDING_BUSINESS' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      refundRequest: { findFirst: jest.fn().mockResolvedValue(null) },
      clubAdmin: { findMany: jest.fn().mockResolvedValue([{ userId: 'admin' }]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'beerry' }]) },
      notification: { create: jest.fn(), createMany: jest.fn() }, auditLogEntry: { create: jest.fn() },
    };
    const service = new EventsService({ $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) } as never, {} as never, {} as never);
    jest.spyOn(service as any, 'assertCanManageEvent').mockResolvedValue({});
    const current = { id: 'request', status, updatedAt: new Date(0), cancellation: { eventId: 'event' }, orderItem: { clubId: 'club', orderId: 'order' } };
    return { service, tx, current };
  }
  it('requires ownership and creates a request, not a refund', async () => {
    const { service, tx } = fixture();
    expect(await service.requestReplacementRefund(buyer, 'item', { reason: 'No acepto la nueva fecha' })).toEqual({ request: { id: 'request', status: 'PENDING_BUSINESS' } });
    expect(tx.orderItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'item', order: { userId: 'buyer' } } }));
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
  });
  it('does not offer this route for postponement', async () => {
    const { service, tx } = fixture();
    tx.eventCancellation.findUnique.mockResolvedValue(null as never);
    await expect(service.requestReplacementRefund(buyer, 'item', { reason: 'Solicito devolución' })).rejects.toThrow();
    expect(tx.eventBuyerRefundRequest.create).not.toHaveBeenCalled();
  });
  it('repeated buyer submission returns the same request', async () => {
    const { service, tx, current } = fixture();
    tx.eventBuyerRefundRequest.findUnique.mockResolvedValue(current as never);
    await service.requestReplacementRefund(buyer, 'item', { reason: 'Solicito devolución' });
    expect(tx.eventBuyerRefundRequest.create).not.toHaveBeenCalled();
  });
  it('business acceptance cannot authorize money', async () => {
    const { service, tx, current } = fixture();
    tx.eventBuyerRefundRequest.findUnique.mockResolvedValue(current as never);
    const response = await service.reviewBuyerRefund(admin, 'request', { decision: 'APPROVE', reason: 'Aceptamos la solicitud' }, 'club', 'event');
    expect(response.request.status).toBe('PENDING_BEERRY');
  });
  it('Beerry cannot skip business consent', async () => {
    const { service, tx, current } = fixture();
    tx.eventBuyerRefundRequest.findUnique.mockResolvedValue(current as never);
    await expect(service.reviewBuyerRefund(beerry, 'request', { decision: 'APPROVE', reason: 'Revisado por Beerry' })).rejects.toThrow();
    expect(tx.eventBuyerRefundRequest.updateMany).not.toHaveBeenCalled();
  });
  it('authorizes only after business acceptance', async () => {
    const { service, tx, current } = fixture('PENDING_BEERRY');
    tx.eventBuyerRefundRequest.findUnique.mockResolvedValue(current as never);
    expect((await service.reviewBuyerRefund(beerry, 'request', { decision: 'APPROVE', reason: 'Revisado por Beerry' })).request.status).toBe('AUTHORIZED');
  });
  it('rejects competing reviews', async () => {
    const { service, tx, current } = fixture('PENDING_BEERRY');
    tx.eventBuyerRefundRequest.findUnique.mockResolvedValue(current as never);
    tx.eventBuyerRefundRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.reviewBuyerRefund(beerry, 'request', { decision: 'APPROVE', reason: 'Revisado por Beerry' })).rejects.toThrow();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
  it('does not let the business call the Beerry review route', async () => {
    const { service, tx } = fixture('PENDING_BEERRY');
    await expect(service.reviewBuyerRefund(admin, 'request', { decision: 'APPROVE', reason: 'Intento de aprobación' })).rejects.toThrow();
    expect(tx.eventBuyerRefundRequest.updateMany).not.toHaveBeenCalled();
  });
});
