import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';

type JwtExpiresIn = `${number}${'s' | 'm' | 'h' | 'd'}`;

type GenerateAuthTokensInput = {
  userId: string;
  role: UserRole;
  refreshTokenId: string;
};

export type RefreshTokenPayload = {
  sub: string;
  role: UserRole;
  type: 'refresh';
  jti: string;
};

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  type: 'access';
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async generateAuthTokens(input: GenerateAuthTokensInput) {
    const accessExpiresIn = this.getAccessExpiresIn();
    const refreshExpiresIn = this.getRefreshExpiresIn();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        {
          sub: input.userId,
          role: input.role,
          type: 'access',
        },
        {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: accessExpiresIn,
        },
      ),
      this.jwt.signAsync(
        {
          sub: input.userId,
          role: input.role,
          type: 'refresh',
          jti: input.refreshTokenId,
        },
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      accessExpiresIn,
      refreshExpiresIn,
    };
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.jwt.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  getRefreshTokenExpiresAt(): Date {
    return addDuration(new Date(), this.getRefreshExpiresIn());
  }

  private getAccessExpiresIn(): JwtExpiresIn {
    return this.config.get<JwtExpiresIn>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
  }

  private getRefreshExpiresIn(): JwtExpiresIn {
    return this.config.get<JwtExpiresIn>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
  }
}

const addDuration = (date: Date, duration: string): Date => {
  const match = /^(\d+)([smhd])$/.exec(duration);

  if (!match) {
    return new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(date.getTime() + amount * multipliers[unit]);
};
