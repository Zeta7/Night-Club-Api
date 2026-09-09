/// <reference types="jest" />
import { EventsService } from '../../../src/modules/events/application/events.service';
import { UserRole } from '@prisma/client';

describe('business cancellation correction', () => {
  const user = { id: 'owner', role: UserRole.ADMIN };
  function fixture(status: string) {
    const tx = {
      $queryRaw: jest.fn(),
      eventCancellation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'case', status, mode: 'REFUND_DECLINED', reason: 'Original reason', updatedAt: new Date(0) }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn(),
      },
      auditLogEntry: { create: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'reviewer' }]) },
      notification: { createMany: jest.fn() },
    };
    const service = new EventsService({ $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) } as never, {} as never, {} as never);
    jest.spyOn(service as any, 'assertCanManageEvent').mockResolvedValue({});
    return { service, tx };
  }
  it.each(['CONTACT_REQUIRED', 'REJECTED', 'REPLACEMENT_PROPOSED'])('resubmits %s for Beerry review, never money execution', async (status) => {
    const { service, tx } = fixture(status);
    await service.requestCancellationRefund(user, 'club', 'event', { reason: 'Aceptamos las devoluciones' });
    expect(tx.eventCancellation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status }), data: expect.objectContaining({ status: 'PENDING_BEERRY', mode: 'REFUND_REQUESTED', reviewedAt: null }),
    }));
    expect(tx.auditLogEntry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      metadata: expect.objectContaining({ previousStatus: status, previousReason: 'Original reason' }),
    }) }));
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
  });
  it.each(['AUTHORIZED', 'PENDING_BEERRY'])('does not overwrite %s', async (status) => {
    const { service, tx } = fixture(status);
    await expect(service.requestCancellationRefund(user, 'club', 'event', { reason: 'Cambio de decisión' })).rejects.toThrow();
    expect(tx.eventCancellation.updateMany).not.toHaveBeenCalled();
  });
  it('rejects a concurrent change without sending notifications', async () => {
    const { service, tx } = fixture('CONTACT_REQUIRED');
    tx.eventCancellation.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.requestCancellationRefund(user, 'club', 'event', { reason: 'Cambio de decisión' })).rejects.toThrow();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });
});
