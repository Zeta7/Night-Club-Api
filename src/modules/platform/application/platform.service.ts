import { Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { conflict, notFound } from '../../../shared/presentation/api-exception';
import { ChangeUserRoleDto } from '../presentation/dto/change-user-role.dto';
import { UpdatePlatformSettingsDto } from '../presentation/dto/update-platform-settings.dto';

const PLATFORM_SETTINGS_ID = 'platform';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

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

  async updateSettings(input: UpdatePlatformSettingsDto) {
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

    return {
      message: 'Configuracion de plataforma actualizada correctamente.',
      settings: parseSettings(settings.settingsJson),
    };
  }

  async changeUserRole(userId: string, input: ChangeUserRoleDto) {
    const user = await this.findUserOrFail(userId);

    if (user.role === UserRole.SUPER_ADMIN && input.role !== UserRole.SUPER_ADMIN) {
      await this.assertAnotherSuperAdminExists(user.id);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { role: input.role },
    });

    return {
      message: 'Rol de usuario actualizado correctamente.',
      user: toPlatformUser(updatedUser),
    };
  }

  async activateUser(userId: string) {
    const user = await this.findUserOrFail(userId);
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.ACTIVE },
    });

    return {
      message: 'Usuario activado correctamente.',
      user: toPlatformUser(updatedUser),
    };
  }

  async deactivateUser(userId: string) {
    const user = await this.findUserOrFail(userId);

    if (user.role === UserRole.SUPER_ADMIN) {
      await this.assertAnotherActiveSuperAdminExists(user.id);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.INACTIVE },
    });

    return {
      message: 'Usuario desactivado correctamente.',
      user: toPlatformUser(updatedUser),
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

  private async assertAnotherSuperAdminExists(currentUserId: string) {
    const superAdmins = await this.prisma.user.count({
      where: {
        id: { not: currentUserId },
        role: UserRole.SUPER_ADMIN,
      },
    });

    if (superAdmins === 0) {
      throw conflict(
        'LAST_SUPER_ADMIN_ROLE_CHANGE_NOT_ALLOWED',
        'No puedes quitar el rol al ultimo Super Admin.',
      );
    }
  }

  private async assertAnotherActiveSuperAdminExists(currentUserId: string) {
    const activeSuperAdmins = await this.prisma.user.count({
      where: {
        id: { not: currentUserId },
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    if (activeSuperAdmins === 0) {
      throw conflict(
        'LAST_ACTIVE_SUPER_ADMIN_DEACTIVATION_NOT_ALLOWED',
        'No puedes desactivar al ultimo Super Admin activo.',
      );
    }
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
  role: UserRole;
  status: UserStatus;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: user.id,
  phoneCountryCode: user.phoneCountryCode,
  phoneNumber: user.phoneNumber,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  status: user.status,
  phoneVerifiedAt: user.phoneVerifiedAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
