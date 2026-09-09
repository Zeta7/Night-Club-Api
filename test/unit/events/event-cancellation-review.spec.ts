/// <reference types="jest" />
import { UserRole } from '@prisma/client';
import { EventsService } from '../../../src/modules/events/application/events.service';

describe('Beerry cancellation decisions', () => {
  const admin = { id: 'beerry', role: UserRole.SUPER_ADMIN };
  function fixture(mode: string, status: string, count = 1) {
    const updateMany = jest.fn().mockResolvedValue({ count });
    const tx = {
      eventCancellation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'case', mode, status, event: { clubId: 'club' } }),
        updateMany, findUniqueOrThrow: jest.fn().mockResolvedValue({ status: 'AUTHORIZED' }),
      },
      auditLogEntry: { create: jest.fn() },
    };
    const service = new EventsService({ $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) } as never, {} as never, {} as never);
    return { service, updateMany };
  }
  it.each([['REFUND_DECLINED', 'CONTACT_REQUIRED'], ['REPLACEMENT', 'REPLACEMENT_PROPOSED']])('cannot approve %s as a refund request', async (mode, status) => {
    const { service, updateMany } = fixture(mode, status);
    await expect(service.reviewCancellation(admin, 'case', { decision: 'APPROVE', reason: 'Reviewed by Beerry' })).rejects.toThrow();
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('records an authorization only after the business requested a refund', async () => {
    const { service, updateMany } = fixture('REFUND_REQUESTED', 'PENDING_BEERRY');
    await service.reviewCancellation(admin, 'case', { decision: 'APPROVE', reason: 'Reviewed by Beerry' });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'AUTHORIZED', reviewedByUserId: 'beerry' }) }));
  });
  it('rejects competing decisions', async () => {
    const { service } = fixture('REFUND_REQUESTED', 'PENDING_BEERRY', 0);
    await expect(service.reviewCancellation(admin, 'case', { decision: 'REJECT', reason: 'Needs clarification' })).rejects.toThrow();
  });
  it('does not let a business approve its own cancellation', async () => {
    const { service } = fixture('REFUND_REQUESTED', 'PENDING_BEERRY');
    await expect(service.reviewCancellation({ id: 'business', role: UserRole.ADMIN }, 'case', { decision: 'APPROVE', reason: 'Approve my request' })).rejects.toThrow();
  });
});
