import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import { buildMediaUrl } from '../../../shared/infrastructure/media/media-url';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { UploadsService } from '../../uploads/application/uploads.service';
import { SearchUsersDto } from '../presentation/dto/search-users.dto';
import { UpdateMyProfileDto } from '../presentation/dto/update-my-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly uploadsService: UploadsService,
  ) {}

  async searchUsers(currentUser: AuthenticatedUser, input: SearchUsersDto) {
    this.assertCanSearchUsers(currentUser);

    const query = input.query.trim();
    const users = await this.prisma.user.findMany({
      where: {
        ...(currentUser.role === UserRole.ADMIN ? { status: UserStatus.ACTIVE } : {}),
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { phoneCountryCode: { contains: query } },
          { phoneNumber: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ fullName: 'asc' }, { createdAt: 'desc' }],
      take: 10,
    });

    return {
      message: 'Usuarios encontrados correctamente.',
      users: users.map(toUserSearchResult),
    };
  }

  async updateMyProfile(currentUser: AuthenticatedUser, input: UpdateMyProfileDto) {
    this.assertProfileImageMutation(input.imageUploadId, input.removeProfileImage);

    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
    });

    if (!user) {
      throw notFound('USER_NOT_FOUND', 'No encontramos el usuario autenticado.');
    }

    const data: {
      fullName?: string;
      email?: string | null;
      profileImageUrl?: string | null;
    } = {};

    if (input.fullName !== undefined) {
      const fullName = input.fullName.trim();
      if (fullName.length < 2) {
        throw badRequest('INVALID_FULL_NAME', 'Ingresa un nombre completo valido.');
      }
      data.fullName = fullName;
    }

    if (input.email !== undefined) {
      const normalizedEmail = input.email.trim().toLowerCase();
      if (!normalizedEmail) {
        data.email = null;
      } else {
        const existingUser = await this.prisma.user.findFirst({
          where: {
            email: normalizedEmail,
            NOT: { id: currentUser.id },
          },
        });

        if (existingUser) {
          throw conflict('EMAIL_ALREADY_REGISTERED', 'El correo electronico ya esta registrado.');
        }

        data.email = normalizedEmail;
      }
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      if (input.imageUploadId) {
        const uploaded = user.profileImageUrl
          ? await this.uploadsService.replaceUpload({
              uploadId: input.imageUploadId,
              userId: currentUser.id,
              previousObjectKey: user.profileImageUrl,
              transaction: tx,
            })
          : await this.uploadsService.consumeUpload({
              uploadId: input.imageUploadId,
              userId: currentUser.id,
              transaction: tx,
            });
        data.profileImageUrl = uploaded.objectKey;
      } else if (input.removeProfileImage) {
        data.profileImageUrl = null;
        await this.uploadsService.queueObjectDeletion(user.profileImageUrl, tx);
      }

      return tx.user.update({
        where: { id: currentUser.id },
        data,
      });
    });

    return {
      message: 'Perfil actualizado correctamente.',
      user: toUserProfile(updatedUser, this.config),
    };
  }

  private assertCanSearchUsers(currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw forbidden('USER_SEARCH_FORBIDDEN', 'No tienes permisos para buscar usuarios.');
    }
  }

  private assertProfileImageMutation(imageUploadId?: string, removeProfileImage?: boolean) {
    if (imageUploadId && removeProfileImage) {
      throw badRequest(
        'INVALID_PROFILE_IMAGE_MUTATION',
        'No puedes enviar imageUploadId y removeProfileImage al mismo tiempo.',
      );
    }
  }
}

const toUserSearchResult = (user: {
  id: string;
  phoneCountryCode: string;
  phoneNumber: string;
  email: string | null;
  fullName: string;
  role: UserRole;
  status: UserStatus;
}) => ({
  id: user.id,
  phoneCountryCode: user.phoneCountryCode,
  phoneNumber: user.phoneNumber,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  status: user.status,
});

const toUserProfile = (
  user: {
    id: string;
    phoneCountryCode: string;
    phoneNumber: string;
    email: string | null;
    fullName: string;
    profileImageUrl: string | null;
    role: UserRole;
    status: UserStatus;
  },
  config: ConfigService,
) => ({
  id: user.id,
  phoneCountryCode: user.phoneCountryCode,
  phoneNumber: user.phoneNumber,
  email: user.email,
  fullName: user.fullName,
  profileImage: buildMediaUrl(user.profileImageUrl, config),
  profileImageObjectKey: user.profileImageUrl,
  role: user.role,
  status: user.status,
});
