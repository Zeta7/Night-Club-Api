/// <reference types="jest" />
import { EventStatus, UserRole } from '@prisma/client';
import { EventsService } from '../../../src/modules/events/application/events.service';

describe('Postponement and rescheduling', () => {
  const user = { id: 'admin', role: UserRole.SUPER_ADMIN };
  function fixture(status: EventStatus) {
    const event = { id: 'event', clubId: 'club', name: 'Evento', status, startsAt: new Date('2099-01-01'), endsAt: new Date('2099-01-02') };
    const tx = { $queryRaw: jest.fn(), $executeRaw: jest.fn(), event: { findUniqueOrThrow: jest.fn().mockResolvedValue(event), update: jest.fn() }, auditLogEntry: { create: jest.fn() } };
    const prisma = { club: { findUnique: jest.fn().mockResolvedValue({ id: 'club' }) }, event: { findFirst: jest.fn().mockResolvedValue(event) }, $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) };
    return { tx, service: new EventsService(prisma as never, {} as never, {} as never) };
  }
  it('suspends the event and preserves the rights instead of cancelling them', async () => {
    const { service, tx } = fixture(EventStatus.SALE_ACTIVE);
    await service.postponeEvent(user, 'club', 'event', { reason: 'Nueva fecha por confirmar' });
    expect(tx.event.update).toHaveBeenCalledWith({ where: { id: 'event' }, data: { status: 'POSTPONED' } });
    expect(tx.auditLogEntry.create).toHaveBeenCalled();
  });
  it('rejects rescheduling a cancelled event', async () => {
    const { service, tx } = fixture(EventStatus.CANCELLED);
    await expect(service.rescheduleEvent(user, 'club', 'event', { reason: 'Nueva fecha confirmada', startsAt: '2099-02-01T20:00:00Z', endsAt: '2099-02-02T05:00:00Z' })).rejects.toThrow();
    expect(tx.event.update).not.toHaveBeenCalled();
  });
  it('shifts windows transactionally and requires an explicit sales restart', async () => {
    const { service, tx } = fixture(EventStatus.POSTPONED);
    await service.rescheduleEvent(user, 'club', 'event', { reason: 'Nueva fecha confirmada', startsAt: '2099-02-01T20:00:00Z', endsAt: '2099-02-02T05:00:00Z' });
    expect(tx.event.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED' }) }));
    expect(tx.$executeRaw).toHaveBeenCalledTimes(5);
  });
});
