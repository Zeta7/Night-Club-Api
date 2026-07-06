import { Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { forbidden } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../identity/presentation/current-user';
import { SearchUsersDto } from '../presentation/dto/search-users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  private assertCanSearchUsers(currentUser: AuthenticatedUser) {
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw forbidden('USER_SEARCH_FORBIDDEN', 'No tienes permisos para buscar usuarios.');
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
