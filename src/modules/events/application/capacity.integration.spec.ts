/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { UserRole, WorkerPermission } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CapacityService } from './capacity.service';

jest.setTimeout(180_000);

describe('Module 10 - realtime capacity', () => {
  const prisma = new PrismaService(new ConfigService());
  const service = new CapacityService(prisma);
  const suffix = randomUUID().slice(0, 8);
  let adminId: string;
  let workerId: string;
  let clubId: string;
  let eventId: string;
  const admin = () => ({ id: adminId, role: UserRole.ADMIN });
  const worker = () => ({ id: workerId, role: UserRole.WORKER });

  beforeAll(async () => {
    await prisma.$connect();
    const stamp = Date.now().toString().slice(-7);
    const [adminUser, workerUser] = await Promise.all([
      prisma.user.create({ data: { phoneCountryCode: '+51', phoneNumber: `71${stamp}`, passwordHash: 'test', fullName: `Capacity Admin ${suffix}`, role: 'ADMIN', status: 'ACTIVE' } }),
      prisma.user.create({ data: { phoneCountryCode: '+51', phoneNumber: `72${stamp}`, passwordHash: 'test', fullName: `Capacity Worker ${suffix}`, role: 'WORKER', status: 'ACTIVE' } }),
    ]);
    adminId = adminUser.id; workerId = workerUser.id;
    const club = await prisma.club.create({ data: { name: `Capacity Club ${suffix}`, status: 'ACTIVE' } });
    clubId = club.id;
    await prisma.clubAdmin.create({ data: { clubId, userId: adminId } });
    await prisma.clubWorker.create({ data: { clubId, userId: workerId, roleLabel: 'Aforo', permissions: [WorkerPermission.VIEW_CAPACITY] } });
    const event = await prisma.event.create({ data: { clubId, name: `Capacity Event ${suffix}`, startsAt: new Date(), endsAt: new Date(Date.now() + 3_600_000), capacity: 2, status: 'IN_PROGRESS' } });
    eventId = event.id;
  });

  afterAll(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { clubId } });
    await prisma.event.delete({ where: { id: eventId } });
    await prisma.clubWorker.deleteMany({ where: { clubId } });
    await prisma.clubAdmin.deleteMany({ where: { clubId } });
    await prisma.club.delete({ where: { id: clubId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, workerId] } } });
    await prisma.$disconnect();
  });

  it('starts at zero and exposes capacity only to authorized users', async () => {
    expect(await service.get(worker(), clubId, eventId)).toMatchObject({ current: 0, capacity: 2, full: false });
    await expect(service.get({ id: randomUUID(), role: UserRole.WORKER }, clubId, eventId)).rejects.toBeDefined();
  });

  it('never exceeds the event limit under concurrent entries', async () => {
    const results = await Promise.allSettled([`ticket-a-${suffix}`, `ticket-b-${suffix}`, `ticket-c-${suffix}`].map((ticketId) =>
      prisma.$transaction((tx) => service.registerEntry(tx, { eventId, clubId, actorUserId: workerId, ticketId })),
    ));
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(await service.get(worker(), clubId, eventId)).toMatchObject({ current: 2, full: true, available: 0 });
  });

  it('registers exits idempotently and supports controlled reentry', async () => {
    const ticketId = `ticket-a-${suffix}`;
    const firstExit = await service.registerExit(admin(), clubId, eventId, ticketId, `exit-capacity-${suffix}`);
    const repeatedExit = await service.registerExit(admin(), clubId, eventId, ticketId, `exit-capacity-${suffix}`);
    expect(firstExit.current).toBe(1);
    expect(repeatedExit.current).toBe(1);
    await expect(prisma.$transaction((tx) => service.registerEntry(tx, { eventId, clubId, actorUserId: workerId, ticketId }))).rejects.toBeDefined();
    await service.configure(admin(), clubId, eventId, true);
    await prisma.$transaction((tx) => service.registerEntry(tx, { eventId, clubId, actorUserId: workerId, ticketId }));
    expect((await service.get(admin(), clubId, eventId)).current).toBe(2);
  });

  it('requires MANAGE_CAPACITY and a bounded target for corrections', async () => {
    await expect(service.correct(worker(), clubId, eventId, 1, 'Conteo manual supervisado')).rejects.toBeDefined();
    await expect(service.correct(admin(), clubId, eventId, 3, 'Supera el máximo permitido')).rejects.toBeDefined();
    const corrected = await service.correct(admin(), clubId, eventId, 1, 'Conteo manual supervisado', `correction-capacity-${suffix}`);
    expect(corrected.current).toBe(1);
  });

  it('keeps an immutable history whose deltas reconcile with occupancy', async () => {
    const history = await service.history(admin(), clubId, eventId);
    const chronological = [...history.items].reverse();
    expect(chronological.reduce((total, movement) => total + movement.delta, 0)).toBe(1);
    expect(chronological.at(-1)?.newCount).toBe(1);
    expect(chronological.some((movement) => movement.type === 'ENTRY')).toBe(true);
    expect(chronological.some((movement) => movement.type === 'EXIT')).toBe(true);
    expect(chronological.some((movement) => movement.type === 'CORRECTION')).toBe(true);
  });
});
