/// <reference types="jest" />
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { UserRole, WorkerPermission } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CommerceService } from '../../commerce/application/commerce.service';
import { SimulatedPaymentGateway } from '../../commerce/infrastructure/simulated-payment.gateway';
import { ClubWorkersService } from './club-workers.service';

jest.setTimeout(180_000);

describe('Module 9 - worker operations', () => {
  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const service = new ClubWorkersService(prisma, config);
  const commerce = new CommerceService(prisma, config, {} as any, new SimulatedPaymentGateway());
  const suffix = randomUUID().slice(0, 8);
  let adminId: string;
  let workerUserId: string;
  let clubId: string;
  let otherClubId: string;
  let workerId: string;

  const admin = () => ({ id: adminId, role: UserRole.ADMIN });
  const worker = () => ({ id: workerUserId, role: UserRole.WORKER });

  beforeAll(async () => {
    await prisma.$connect();
    const stamp = Date.now().toString().slice(-7);
    const [adminUser, workerUser] = await Promise.all([
      prisma.user.create({ data: { phoneCountryCode: '+51', phoneNumber: `81${stamp}`, passwordHash: 'test', fullName: `Admin M9 ${suffix}`, role: 'ADMIN', status: 'ACTIVE' } }),
      prisma.user.create({ data: { phoneCountryCode: '+51', phoneNumber: `82${stamp}`, passwordHash: 'test', fullName: `Worker M9 ${suffix}`, role: 'WORKER', status: 'ACTIVE' } }),
    ]);
    adminId = adminUser.id; workerUserId = workerUser.id;
    const [club, other] = await Promise.all([
      prisma.club.create({ data: { name: `Worker Club ${suffix}`, status: 'ACTIVE' } }),
      prisma.club.create({ data: { name: `Other Club ${suffix}`, status: 'ACTIVE' } }),
    ]);
    clubId = club.id; otherClubId = other.id;
    await prisma.clubAdmin.create({ data: { clubId, userId: adminId } });
    const registered = await service.registerWorker(admin(), clubId, {
      userId: workerUserId,
      roleLabel: 'Puerta principal',
      permissions: [WorkerPermission.VIEW_OPERATIONS, WorkerPermission.VALIDATE_TICKETS],
    });
    workerId = registered.worker.id;
  });

  afterAll(async () => {
    await prisma.auditLogEntry.deleteMany({ where: { clubId } });
    await prisma.clubWorker.deleteMany({ where: { clubId } });
    await prisma.clubAdmin.deleteMany({ where: { clubId } });
    await prisma.club.deleteMany({ where: { id: { in: [clubId, otherClubId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, workerUserId] } } });
    await prisma.$disconnect();
  });

  it('prevents a worker from operating another business', async () => {
    await expect(service.startShift(worker(), otherClubId, { deviceFingerprint: 'device-module-nine' })).rejects.toBeDefined();
    await expect(commerce.getClubOperations(worker(), otherClubId)).rejects.toBeDefined();
  });

  it('hides nothing through trust: backend rejects worker administration actions', async () => {
    await expect(service.replacePermissions(worker(), clubId, workerId, { permissions: [] })).rejects.toBeDefined();
    await expect(service.authorizeDevice(worker(), clubId, workerId, { fingerprint: 'device-module-nine', name: 'Android test', platform: 'android' })).rejects.toBeDefined();
  });

  it('revokes a permission with immediate effect', async () => {
    await expect(commerce.getClubOperations(worker(), clubId)).resolves.toBeDefined();
    await service.replacePermissions(admin(), clubId, workerId, { permissions: [WorkerPermission.VALIDATE_TICKETS] });
    await expect(commerce.getClubOperations(worker(), clubId)).rejects.toBeDefined();
    await service.replacePermissions(admin(), clubId, workerId, { permissions: [WorkerPermission.VIEW_OPERATIONS, WorkerPermission.VALIDATE_TICKETS] });
  });

  it('authorizes a device and closes its active shift remotely', async () => {
    await service.updateWorker(admin(), clubId, workerId, { assignedDoor: 'Puerta 1', assignedZone: 'Ingreso', assignedPoint: 'Scanner A' });
    const authorized = await service.authorizeDevice(admin(), clubId, workerId, { fingerprint: 'device-module-nine', name: 'Android test', platform: 'android' });
    const started = await service.startShift(worker(), clubId, { deviceFingerprint: 'device-module-nine' });
    expect(started.shift.assignedDoor).toBe('Puerta 1');
    await expect(service.syncShift(worker(), clubId, started.shift.id, { lastClientActivityAt: new Date().toISOString() })).resolves.toBeDefined();
    await service.closeShift(admin(), clubId, workerId, started.shift.id, 'Fin remoto del turno');
    await expect(service.syncShift(worker(), clubId, started.shift.id, { lastClientActivityAt: new Date().toISOString() })).rejects.toBeDefined();
    expect((await service.listShifts(admin(), clubId, workerId)).items[0].status).toBe('CLOSED');
    expect(authorized.device.status).toBe('AUTHORIZED');
  });

  it('records worker changes and exposes a traceable report', async () => {
    await prisma.qrValidationAttempt.create({ data: { clubId, actorUserId: workerUserId, outcome: 'VALID', codeFingerprint: `m9-${suffix}` } });
    const report = await service.workerReport(admin(), clubId, workerId);
    expect(report.validations.VALID).toBeGreaterThanOrEqual(1);
    expect(report.auditedActions).toBeGreaterThanOrEqual(1);
    expect(report.shifts).toHaveLength(1);
    expect(await prisma.auditLogEntry.count({ where: { clubId, resourceType: 'WORKER_SHIFT' } })).toBeGreaterThanOrEqual(2);
    await prisma.qrValidationAttempt.deleteMany({ where: { clubId, codeFingerprint: `m9-${suffix}` } });
  });
});
