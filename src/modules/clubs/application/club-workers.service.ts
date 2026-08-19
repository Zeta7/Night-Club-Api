import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClubWorkerStatus, UserRole, UserStatus } from '@prisma/client';
import { buildMediaUrl } from '../../../shared/infrastructure/media/media-url';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { conflict, forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { RegisterClubWorkerDto } from '../presentation/dto/register-club-worker.dto';
import { ReplaceClubWorkerPermissionsDto } from '../presentation/dto/replace-club-worker-permissions.dto';
import { UpdateClubWorkerDto } from '../presentation/dto/update-club-worker.dto';
import { AuthorizeWorkerDeviceDto, StartWorkerShiftDto, SyncWorkerShiftDto } from '../presentation/dto/worker-operations.dto';

@Injectable()
export class ClubWorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async registerWorker(
    currentUser: AuthenticatedUser,
    clubId: string,
    input: RegisterClubWorkerDto,
  ) {
    await this.assertCanManageClub(currentUser, clubId);
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });

    if (!user) {
      throw notFound('USER_NOT_FOUND', 'No encontramos el usuario solicitado.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw conflict('USER_NOT_ACTIVE', 'El usuario debe estar activo para ser trabajador.');
    }

    const existingWorker = await this.prisma.clubWorker.findUnique({
      where: {
        clubId_userId: {
          clubId,
          userId: input.userId,
        },
      },
    });

    if (existingWorker) {
      throw conflict('CLUB_WORKER_ALREADY_EXISTS', 'El usuario ya es trabajador de este club.');
    }

    const worker = await this.prisma.$transaction(async (tx) => {
      if (user.role === UserRole.CUSTOMER) {
        await tx.user.update({
          where: { id: user.id },
          data: { role: UserRole.WORKER },
        });
      }

      const created = await tx.clubWorker.create({
        data: {
          clubId,
          userId: input.userId,
          roleLabel: input.roleLabel.trim(),
          permissions: input.permissions,
        },
        include: workerInclude,
      });
      await tx.auditLogEntry.create({ data: { actorUserId: currentUser.id, clubId, action: 'REGISTER_WORKER', resourceType: 'CLUB_WORKER', resourceId: created.id, metadata: { permissions: input.permissions } } });
      return created;
    });

    return {
      message: 'Trabajador registrado correctamente.',
      worker: toWorkerResponse(worker, this.config),
    };
  }

  async listWorkers(currentUser: AuthenticatedUser, clubId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    const workers = await this.prisma.clubWorker.findMany({
      where: { clubId },
      orderBy: { createdAt: 'desc' },
      include: workerInclude,
    });

    return {
      message: 'Trabajadores obtenidos correctamente.',
      workers: workers.map((worker) => toWorkerResponse(worker, this.config)),
    };
  }

  async updateWorker(
    currentUser: AuthenticatedUser,
    clubId: string,
    workerId: string,
    input: UpdateClubWorkerDto,
  ) {
    await this.assertCanManageClub(currentUser, clubId);
    await this.findWorkerOrFail(clubId, workerId);

    const worker = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.clubWorker.update({
        where: { id: workerId },
        data: {
          ...(input.status != null ? { status: input.status } : {}),
          ...(input.roleLabel != null ? { roleLabel: input.roleLabel.trim() } : {}),
          ...(input.assignedDoor !== undefined ? { assignedDoor: input.assignedDoor.trim() || null } : {}),
          ...(input.assignedZone !== undefined ? { assignedZone: input.assignedZone.trim() || null } : {}),
          ...(input.assignedPoint !== undefined ? { assignedPoint: input.assignedPoint.trim() || null } : {}),
        },
        include: workerInclude,
      });
      if (input.status === ClubWorkerStatus.INACTIVE) {
        await tx.workerShift.updateMany({ where: { workerId, status: 'ACTIVE' }, data: { status: 'REVOKED', endedAt: new Date(), closedByUserId: currentUser.id, closeReason: 'WORKER_INACTIVE' } });
      }
      await tx.auditLogEntry.create({ data: { actorUserId: currentUser.id, clubId, action: 'UPDATE_WORKER', resourceType: 'CLUB_WORKER', resourceId: workerId, metadata: input as any } });
      return updated;
    });

    return {
      message: 'Trabajador actualizado correctamente.',
      worker: toWorkerResponse(worker, this.config),
    };
  }

  async replacePermissions(
    currentUser: AuthenticatedUser,
    clubId: string,
    workerId: string,
    input: ReplaceClubWorkerPermissionsDto,
  ) {
    await this.assertCanManageClub(currentUser, clubId);
    await this.findWorkerOrFail(clubId, workerId);

    const worker = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.clubWorker.update({ where: { id: workerId }, data: { permissions: input.permissions }, include: workerInclude });
      await tx.auditLogEntry.create({ data: { actorUserId: currentUser.id, clubId, action: 'REPLACE_WORKER_PERMISSIONS', resourceType: 'CLUB_WORKER', resourceId: workerId, metadata: { permissions: input.permissions } } });
      return updated;
    });

    return {
      message: 'Permisos del trabajador actualizados correctamente.',
      worker: toWorkerResponse(worker, this.config),
    };
  }

  async removeWorker(
    currentUser: AuthenticatedUser,
    clubId: string,
    workerId: string,
  ) {
    await this.assertCanManageClub(currentUser, clubId);
    await this.findWorkerOrFail(clubId, workerId);

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLogEntry.create({ data: { actorUserId: currentUser.id, clubId, action: 'REMOVE_WORKER', resourceType: 'CLUB_WORKER', resourceId: workerId } });
      await tx.clubWorker.delete({ where: { id: workerId } });
    });

    return {
      message: 'Trabajador desvinculado correctamente.',
    };
  }

  async authorizeDevice(currentUser: AuthenticatedUser, clubId: string, workerId: string, input: AuthorizeWorkerDeviceDto) {
    await this.assertCanManageClub(currentUser, clubId);
    await this.findWorkerOrFail(clubId, workerId);
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.workerAuthorizedDevice.upsert({
        where: { workerId_fingerprint: { workerId, fingerprint: input.fingerprint.trim() } },
        create: { workerId, fingerprint: input.fingerprint.trim(), name: input.name.trim(), platform: input.platform.trim().toLowerCase(), authorizedByUserId: currentUser.id },
        update: { name: input.name.trim(), platform: input.platform.trim().toLowerCase(), status: 'AUTHORIZED', authorizedByUserId: currentUser.id, revokedAt: null, revokedByUserId: null },
      });
      await tx.auditLogEntry.create({ data: { actorUserId: currentUser.id, clubId, action: 'AUTHORIZE_WORKER_DEVICE', resourceType: 'WORKER_DEVICE', resourceId: device.id, metadata: { workerId, name: device.name, platform: device.platform } } });
      return { device };
    });
  }

  async revokeDevice(currentUser: AuthenticatedUser, clubId: string, workerId: string, deviceId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    await this.findWorkerOrFail(clubId, workerId);
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.workerAuthorizedDevice.updateMany({ where: { id: deviceId, workerId, status: 'AUTHORIZED' }, data: { status: 'REVOKED', revokedAt: new Date(), revokedByUserId: currentUser.id } });
      if (changed.count !== 1) throw notFound('WORKER_DEVICE_NOT_FOUND', 'No se encontró el dispositivo autorizado.');
      await tx.workerShift.updateMany({ where: { workerId, deviceFingerprint: (await tx.workerAuthorizedDevice.findUniqueOrThrow({ where: { id: deviceId } })).fingerprint, status: 'ACTIVE' }, data: { status: 'REVOKED', endedAt: new Date(), closedByUserId: currentUser.id, closeReason: 'DEVICE_REVOKED' } });
      await tx.auditLogEntry.create({ data: { actorUserId: currentUser.id, clubId, action: 'REVOKE_WORKER_DEVICE', resourceType: 'WORKER_DEVICE', resourceId: deviceId, metadata: { workerId } } });
      return { deviceId, status: 'REVOKED' };
    });
  }

  async startShift(currentUser: AuthenticatedUser, clubId: string, input: StartWorkerShiftDto) {
    const worker = await this.prisma.clubWorker.findFirst({ where: { clubId, userId: currentUser.id, status: ClubWorkerStatus.ACTIVE } });
    if (!worker) throw forbidden('ACTIVE_WORKER_REQUIRED', 'No eres un trabajador activo de este negocio.');
    const device = await this.prisma.workerAuthorizedDevice.findFirst({ where: { workerId: worker.id, fingerprint: input.deviceFingerprint.trim(), status: 'AUTHORIZED' } });
    if (!device) throw forbidden('AUTHORIZED_DEVICE_REQUIRED', 'Este dispositivo no está autorizado para operar.');
    if (input.eventId) {
      const event = await this.prisma.event.findFirst({ where: { id: input.eventId, clubId }, select: { id: true } });
      if (!event) throw notFound('EVENT_NOT_FOUND', 'El evento no pertenece al negocio.');
    }
    return this.prisma.$transaction(async (tx) => {
      const active = await tx.workerShift.findFirst({ where: { workerId: worker.id, status: 'ACTIVE' } });
      if (active) throw conflict('WORKER_SHIFT_ALREADY_ACTIVE', 'Ya tienes un turno activo.');
      const shift = await tx.workerShift.create({ data: { workerId: worker.id, eventId: input.eventId, deviceFingerprint: device.fingerprint, openedByUserId: currentUser.id, assignedDoor: worker.assignedDoor, assignedZone: worker.assignedZone, assignedPoint: worker.assignedPoint } });
      await tx.workerAuthorizedDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      await tx.auditLogEntry.create({ data: { actorUserId: currentUser.id, clubId, action: 'START_WORKER_SHIFT', resourceType: 'WORKER_SHIFT', resourceId: shift.id, metadata: { workerId: worker.id, eventId: input.eventId ?? null } } });
      return { shift };
    });
  }

  async syncShift(currentUser: AuthenticatedUser, clubId: string, shiftId: string, input: SyncWorkerShiftDto) {
    const worker = await this.prisma.clubWorker.findFirst({ where: { clubId, userId: currentUser.id, status: 'ACTIVE' } });
    if (!worker) throw forbidden('ACTIVE_WORKER_REQUIRED', 'No eres un trabajador activo de este negocio.');
    const now = new Date();
    const changed = await this.prisma.workerShift.updateMany({ where: { id: shiftId, workerId: worker.id, status: 'ACTIVE' }, data: { lastActivityAt: new Date(input.lastClientActivityAt), lastSyncAt: now } });
    if (changed.count !== 1) throw forbidden('WORKER_SHIFT_NOT_ACTIVE', 'El turno ya no está activo o fue cerrado remotamente.');
    return { shiftId, syncedAt: now };
  }

  async listShifts(currentUser: AuthenticatedUser, clubId: string, workerId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    await this.findWorkerOrFail(clubId, workerId);
    return { items: await this.prisma.workerShift.findMany({ where: { workerId }, include: { event: { select: { id: true, name: true } } }, orderBy: { startedAt: 'desc' }, take: 100 }) };
  }

  async closeShift(currentUser: AuthenticatedUser, clubId: string, workerId: string, shiftId: string, reason: string) {
    await this.assertCanManageClub(currentUser, clubId);
    await this.findWorkerOrFail(clubId, workerId);
    return this.prisma.$transaction(async (tx) => {
      const endedAt = new Date();
      const changed = await tx.workerShift.updateMany({ where: { id: shiftId, workerId, status: 'ACTIVE' }, data: { status: 'CLOSED', endedAt, closedByUserId: currentUser.id, closeReason: reason.trim() } });
      if (changed.count !== 1) throw conflict('WORKER_SHIFT_NOT_ACTIVE', 'El turno ya no está activo.');
      await tx.auditLogEntry.create({ data: { actorUserId: currentUser.id, clubId, action: 'CLOSE_WORKER_SHIFT', resourceType: 'WORKER_SHIFT', resourceId: shiftId, metadata: { workerId, reason: reason.trim() } } });
      return { shiftId, status: 'CLOSED', endedAt };
    });
  }

  async workerReport(currentUser: AuthenticatedUser, clubId: string, workerId: string) {
    await this.assertCanManageClub(currentUser, clubId);
    const worker = await this.findWorkerOrFail(clubId, workerId);
    const [shifts, validations, actions, devices] = await Promise.all([
      this.prisma.workerShift.findMany({ where: { workerId }, orderBy: { startedAt: 'desc' }, take: 100 }),
      this.prisma.qrValidationAttempt.groupBy({ by: ['outcome'], where: { clubId, actorUserId: worker.userId }, _count: true }),
      this.prisma.auditLogEntry.count({ where: { clubId, actorUserId: worker.userId } }),
      this.prisma.workerAuthorizedDevice.findMany({ where: { workerId }, orderBy: { updatedAt: 'desc' } }),
    ]);
    return { workerId, shifts, validations: Object.fromEntries(validations.map((item) => [item.outcome, item._count])), auditedActions: actions, devices };
  }

  private async assertCanManageClub(currentUser: AuthenticatedUser, clubId: string) {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
    });

    if (!club) {
      throw notFound('CLUB_NOT_FOUND', 'No encontramos el club solicitado.');
    }

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (currentUser.role !== UserRole.ADMIN) {
      throw forbidden('CLUB_MANAGE_FORBIDDEN', 'No tienes permisos para administrar este club.');
    }

    const clubAdmin = await this.prisma.clubAdmin.findUnique({
      where: {
        clubId_userId: {
          clubId,
          userId: currentUser.id,
        },
      },
    });

    if (!clubAdmin) {
      throw forbidden('CLUB_MANAGE_FORBIDDEN', 'No tienes permisos para administrar este club.');
    }
  }

  private async findWorkerOrFail(clubId: string, workerId: string) {
    const worker = await this.prisma.clubWorker.findFirst({
      where: {
        id: workerId,
        clubId,
      },
    });

    if (!worker) {
      throw notFound('CLUB_WORKER_NOT_FOUND', 'No encontramos el trabajador solicitado.');
    }

    return worker;
  }
}

const workerInclude = {
  user: true,
} as const;

const toWorkerResponse = (worker: {
  id: string;
  clubId: string;
  userId: string;
  status: ClubWorkerStatus;
  roleLabel: string | null;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
  assignedDoor: string | null;
  assignedZone: string | null;
  assignedPoint: string | null;
  user: {
    id: string;
    fullName: string;
    phoneCountryCode: string;
    phoneNumber: string;
    email: string | null;
    profileImageUrl: string | null;
    role: UserRole;
    status: UserStatus;
  };
}, config: ConfigService) => ({
  id: worker.id,
  clubId: worker.clubId,
  userId: worker.userId,
  status: worker.status,
  roleLabel: worker.roleLabel,
  permissions: worker.permissions,
  createdAt: worker.createdAt,
  updatedAt: worker.updatedAt,
  assignedDoor: worker.assignedDoor,
  assignedZone: worker.assignedZone,
  assignedPoint: worker.assignedPoint,
  user: {
    id: worker.user.id,
    fullName: worker.user.fullName,
    phoneCountryCode: worker.user.phoneCountryCode,
    phoneNumber: worker.user.phoneNumber,
    email: worker.user.email,
    profileImage: buildMediaUrl(worker.user.profileImageUrl, config),
    role: worker.user.role,
    status: worker.user.status,
  },
});
