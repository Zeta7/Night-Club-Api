import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { forbidden } from '../../../../shared/presentation/api-exception';
import { AuthenticatedUser } from '../../../identity/presentation/current-user';

type AuthenticatedRequest = {
  user?: AuthenticatedUser;
};

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user?.role !== UserRole.SUPER_ADMIN) {
      throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo un Super Admin puede realizar esta accion.');
    }

    return true;
  }
}
