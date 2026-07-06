import { Injectable } from '@nestjs/common';
import { ClubWorkerStatus, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { conflict, forbidden, notFound } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { RegisterClubWorkerDto } from '../presentation/dto/register-club-worker.dto';
import { ReplaceClubWorkerPermissionsDto } from '../presentation/dto/replace-club-worker-permissions.dto';
import { UpdateClubWorkerDto } from '../presentation/dto/update-club-worker.dto';

@Injectable()
export class ClubWorkersService {
  constructor(private readonly prisma: PrismaService) {}

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

      return tx.clubWorker.create({
        data: {
          clubId,
          userId: input.userId,
          permissions: input.permissions,
        },
        include: workerInclude,
      });
    });

    return {
      message: 'Trabajador registrado correctamente.',
      worker: toWorkerResponse(worker),
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
      workers: workers.map(toWorkerResponse),
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

    const worker = await this.prisma.clubWorker.update({
      where: { id: workerId },
      data: {
        status: input.status,
      },
      include: workerInclude,
    });

    return {
      message: 'Trabajador actualizado correctamente.',
      worker: toWorkerResponse(worker),
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

    const worker = await this.prisma.clubWorker.update({
      where: { id: workerId },
      data: {
        permissions: input.permissions,
      },
      include: workerInclude,
    });

    return {
      message: 'Permisos del trabajador actualizados correctamente.',
      worker: toWorkerResponse(worker),
    };
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
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    fullName: string;
    phoneCountryCode: string;
    phoneNumber: string;
    email: string | null;
    role: UserRole;
    status: UserStatus;
  };
}) => ({
  id: worker.id,
  clubId: worker.clubId,
  userId: worker.userId,
  status: worker.status,
  permissions: worker.permissions,
  createdAt: worker.createdAt,
  updatedAt: worker.updatedAt,
  user: {
    id: worker.user.id,
    fullName: worker.user.fullName,
    phoneCountryCode: worker.user.phoneCountryCode,
    phoneNumber: worker.user.phoneNumber,
    email: worker.user.email,
    role: worker.user.role,
    status: worker.user.status,
  },
});
