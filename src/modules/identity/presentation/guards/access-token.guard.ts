import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { unauthorized } from '../../../../shared/presentation/api-exception';
import { TokenService } from '../../application/token.service';
import { AuthenticatedUser } from '../current-user';

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request);

    if (!token) {
      throw unauthorized('ACCESS_TOKEN_REQUIRED', 'Debes enviar un token de acceso.');
    }

    try {
      const payload = await this.tokens.verifyAccessToken(token);

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      request.user = {
        id: payload.sub,
        role: payload.role,
      };

      return true;
    } catch {
      throw unauthorized('INVALID_ACCESS_TOKEN', 'El token de acceso no es valido.');
    }
  }
}

const extractBearerToken = (request: Request): string | null => {
  const authorization = request.headers.authorization;

  if (!authorization) {
    return null;
  }

  const [type, token] = authorization.split(' ');

  if (type !== 'Bearer' || !token) {
    return null;
  }

  return token;
};
