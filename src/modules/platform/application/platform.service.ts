import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import { buildMediaUrl } from '../../../shared/infrastructure/media/media-url';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { notFound } from '../../../shared/presentation/api-exception';
import { ChangeUserRoleDto } from '../presentation/dto/change-user-role.dto';
import { ChangeUserStatusDto } from '../presentation/dto/change-user-status.dto';
import { ListPlatformUsersDto } from '../presentation/dto/list-platform-users.dto';
import { UpdatePlatformSettingsDto } from '../presentation/dto/update-platform-settings.dto';
import { AuditService } from '../../audit/application/audit.service';
import { AuthenticatedUser } from '../../identity/presentation/current-user';

const PLATFORM_SETTINGS_ID = 'platform';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async getDashboard() {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      blockedUsers,
      pendingPhoneConfirmationUsers,
      superAdmins,
      admins,
      workers,
      customers,
      settings,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.INACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.BLOCKED } }),
      this.prisma.user.count({ where: { status: UserStatus.PENDING_PHONE_CONFIRMATION } }),
      this.prisma.user.count({ where: { role: UserRole.SUPER_ADMIN } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.user.count({ where: { role: UserRole.WORKER } }),
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      this.getSettingsRecord(),
    ]);

    return {
      message: 'Dashboard global obtenido correctamente.',
      dashboard: {
        users: {
          total: totalUsers,
          byStatus: {
            active: activeUsers,
            inactive: inactiveUsers,
            blocked: blockedUsers,
            pendingPhoneConfirmation: pendingPhoneConfirmationUsers,
          },
          byRole: {
            superAdmin: superAdmins,
            admin: admins,
            worker: workers,
            customer: customers,
          },
        },
        settings,
      },
    };
  }

  async updateSettings(actor: AuthenticatedUser, input: UpdatePlatformSettingsDto) {
    const settings = await this.prisma.platformSettings.upsert({
      where: { id: PLATFORM_SETTINGS_ID },
      update: {
        settingsJson: JSON.stringify(input.settings),
      },
      create: {
        id: PLATFORM_SETTINGS_ID,
        settingsJson: JSON.stringify(input.settings),
      },
    });
    await this.audit.record({ actorUserId: actor.id, actorRole: actor.role, action: 'UPDATE_PLATFORM_SETTINGS', resourceType: 'PLATFORM_SETTINGS', resourceId: settings.id, severity: 'WARNING', metadata: { settings: input.settings } });

    return {
      message: 'Configuracion de plataforma actualizada correctamente.',
      settings: parseSettings(settings.settingsJson),
    };
  }

  async listUsers(input: ListPlatformUsersDto) {
    const query = input.query?.trim();
    const where = {
      ...(input.role ? { role: input.role } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(query
        ? {
            OR: [
              { fullName: { contains: query, mode: 'insensitive' as const } },
              { phoneCountryCode: { contains: query } },
              { phoneNumber: { contains: query } },
              { email: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 10;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { fullName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      message: 'Usuarios de plataforma obtenidos correctamente.',
      users: users.map((user) => toPlatformUser(user, this.config)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async changeUserRole(actor: AuthenticatedUser, userId: string, input: ChangeUserRoleDto) {
    const user = await this.findUserOrFail(userId);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { role: input.role },
    });
    await this.audit.record({ actorUserId: actor.id, actorRole: actor.role, action: 'CHANGE_USER_ROLE', resourceType: 'USER', resourceId: userId, severity: 'CRITICAL', metadata: { previousRole: user.role, newRole: input.role } });

    return {
      message: 'Rol de usuario actualizado correctamente.',
      user: toPlatformUser(updatedUser, this.config),
    };
  }

  async activateUser(actor: AuthenticatedUser, userId: string) {
    const user = await this.findUserOrFail(userId);
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.ACTIVE },
    });
    await this.audit.record({ actorUserId: actor.id, actorRole: actor.role, action: 'CHANGE_USER_STATUS', resourceType: 'USER', resourceId: userId, severity: 'WARNING', metadata: { previousStatus: user.status, newStatus: UserStatus.ACTIVE } });

    return {
      message: 'Usuario activado correctamente.',
      user: toPlatformUser(updatedUser, this.config),
    };
  }

  async changeUserStatus(actor: AuthenticatedUser, userId: string, input: ChangeUserStatusDto) {
    const user = await this.findUserOrFail(userId);
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: input.status },
    });
    await this.audit.record({ actorUserId: actor.id, actorRole: actor.role, action: 'CHANGE_USER_STATUS', resourceType: 'USER', resourceId: userId, severity: input.status === UserStatus.BLOCKED ? 'CRITICAL' : 'WARNING', metadata: { previousStatus: user.status, newStatus: input.status } });
    return {
      message: 'Estado de usuario actualizado correctamente.',
      user: toPlatformUser(updatedUser, this.config),
    };
  }

  async deactivateUser(actor: AuthenticatedUser, userId: string) {
    const user = await this.findUserOrFail(userId);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.INACTIVE },
    });
    await this.audit.record({ actorUserId: actor.id, actorRole: actor.role, action: 'CHANGE_USER_STATUS', resourceType: 'USER', resourceId: userId, severity: 'WARNING', metadata: { previousStatus: user.status, newStatus: UserStatus.INACTIVE } });

    return {
      message: 'Usuario desactivado correctamente.',
      user: toPlatformUser(updatedUser, this.config),
    };
  }

  async blockUser(actor: AuthenticatedUser, userId: string) {
    const user = await this.findUserOrFail(userId);
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.BLOCKED },
    });
    await this.audit.record({ actorUserId: actor.id, actorRole: actor.role, action: 'CHANGE_USER_STATUS', resourceType: 'USER', resourceId: userId, severity: 'CRITICAL', metadata: { previousStatus: user.status, newStatus: UserStatus.BLOCKED } });
    return {
      message: 'Usuario bloqueado correctamente.',
      user: toPlatformUser(updatedUser, this.config),
    };
  }

  private async findUserOrFail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw notFound('USER_NOT_FOUND', 'No encontramos el usuario solicitado.');
    }

    return user;
  }

  private async getSettingsRecord() {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: PLATFORM_SETTINGS_ID },
    });

    return parseSettings(settings?.settingsJson ?? '{}');
  }
}

const parseSettings = (settingsJson: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(settingsJson);

    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const toPlatformUser = (user: {
  id: string;
  phoneCountryCode: string;
  phoneNumber: string;
  email: string | null;
  fullName: string;
  profileImageUrl: string | null;
  role: UserRole;
  status: UserStatus;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}, config: ConfigService) => ({
  id: user.id,
  phoneCountryCode: user.phoneCountryCode,
  phoneNumber: user.phoneNumber,
  email: user.email,
  fullName: user.fullName,
  profileImage: buildMediaUrl(user.profileImageUrl, config),
  role: user.role,
  status: user.status,
  phoneVerifiedAt: user.phoneVerifiedAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
