/// <reference types="jest" />
import { EventRefundWorker } from '../../../src/modules/commerce/application/event-refund-worker.service';

describe('durable event refund processing', () => {
  function fixture() {
    const job = { id: 'job', leaseToken: 'lease', refundRequestId: 'request', authorizedBy: 'beerry', amountCents: 2500, attempts: 1, orderItem: { orderId: 'order' } };
    const request = { id: 'request', status: 'PROCESSING', externalRefundId: 'mp-refund' };
    const prisma = { eventRefundJob: { findUniqueOrThrow: jest.fn().mockResolvedValue(job), updateMany: jest.fn() }, refundRequest: { findUniqueOrThrow: jest.fn().mockResolvedValue(request) } };
    const commerce = { reconcileEventRefund: jest.fn().mockResolvedValue(false), processRefundRequest: jest.fn() };
    const worker = new EventRefundWorker(prisma as never, commerce as never, {} as never, {} as never);
    return { worker, prisma, commerce, job, request };
  }
  it('waits for the exact provider refund instead of marking approval as completion', async () => {
    const { worker, prisma, commerce } = fixture(); await worker.process('job', 'lease');
    expect(commerce.reconcileEventRefund).toHaveBeenCalledWith('request');
    expect(commerce.processRefundRequest).not.toHaveBeenCalled();
    expect(prisma.eventRefundJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'WAITING_PROVIDER' }) }));
  });
  it('an expired lease cannot start another refund', async () => {
    const { worker, commerce } = fixture(); await worker.process('job', 'stale');
    expect(commerce.reconcileEventRefund).not.toHaveBeenCalled();
  });
  it('keeps the same request on a retry after a timeout', async () => {
    const { worker, commerce, request, prisma } = fixture(); request.externalRefundId = null as never;
    commerce.processRefundRequest.mockRejectedValue(new Error('timeout'));
    await worker.process('job', 'lease');
    expect(commerce.processRefundRequest).toHaveBeenCalledWith(expect.objectContaining({ id: 'beerry' }), 'request', 2500, expect.any(String), true);
    expect(prisma.eventRefundJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'QUEUED' }) }));
  });
  it('moves repeated failures to manual reconciliation', async () => {
    const { worker, job, commerce, prisma } = fixture(); job.attempts = 13;
    await worker.process('job', 'lease'); expect(commerce.processRefundRequest).not.toHaveBeenCalled();
    expect(prisma.eventRefundJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'MANUAL_REVIEW' }) }));
  });
});
