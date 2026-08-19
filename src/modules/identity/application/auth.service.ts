import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { PhoneVerificationPurpose, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { NotificationService } from '../../notification/application/notification.service';
import { buildMediaUrl } from '../../../shared/infrastructure/media/media-url';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  badRequest,
  conflict,
  notFound,
  unauthorized,
} from '../../../shared/presentation/api-exception';
import { TokenService } from './token.service';
import { VerificationCodeService } from './verification-code.service';
import { ConfirmPhoneDto } from '../presentation/dto/confirm-phone.dto';
import { LoginDto } from '../presentation/dto/login.dto';
import { LogoutDto } from '../presentation/dto/logout.dto';
import { RefreshTokenDto } from '../presentation/dto/refresh-token.dto';
import { RegisterUserDto } from '../presentation/dto/register-user.dto';
import { RequestPasswordResetDto } from '../presentation/dto/request-password-reset.dto';
import { ResendPhoneCodeDto } from '../presentation/dto/resend-phone-code.dto';
import { ResetPasswordDto } from '../presentation/dto/reset-password.dto';

const PHONE_CODE_EXPIRATION_MINUTES = 10;
const MAX_PHONE_CODE_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly verificationCodes: VerificationCodeService,
    private readonly notifications: NotificationService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterUserDto) {
    const phoneCountryCode = normalizeText(input.phoneCountryCode);
    const phoneNumber = normalizeText(input.phoneNumber);
    const email = input.email ? normalizeEmail(input.email) : null;

    const existingUserByPhone = await this.prisma.user.findUnique({
      where: {
        phoneCountryCode_phoneNumber: {
          phoneCountryCode,
          phoneNumber,
        },
      },
    });

    if (existingUserByPhone) {
      throw conflict('PHONE_ALREADY_REGISTERED', 'El numero de telefono ya esta registrado.');
    }

    if (email) {
      const existingUserByEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUserByEmail) {
        throw conflict('EMAIL_ALREADY_REGISTERED', 'El correo electronico ya esta registrado.');
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        phoneCountryCode,
        phoneNumber,
        email,
        passwordHash,
        fullName: normalizeText(input.fullName),
      },
    });

    await this.createAndSendPhoneCode({
      userId: user.id,
      phoneCountryCode,
      phoneNumber,
      purpose: PhoneVerificationPurpose.REGISTRATION,
    });

    return {
      message: 'Registro creado correctamente. Te enviamos un codigo para confirmar tu telefono.',
      user: this.toPublicUser(user),
    };
  }

  async confirmPhone(input: ConfirmPhoneDto) {
    const phoneCountryCode = normalizeText(input.phoneCountryCode);
    const phoneNumber = normalizeText(input.phoneNumber);
    const user = await this.findUserByPhone(phoneCountryCode, phoneNumber);

    if (!user) {
      throw notFound('USER_NOT_FOUND', 'No encontramos un usuario con ese telefono.');
    }

    if (user.phoneVerifiedAt) {
      await this.prisma.wallet.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });
      return {
        message: 'El telefono ya estaba confirmado.',
      };
    }

    const verificationCode = await this.validatePhoneCode({
      userId: user.id,
      purpose: PhoneVerificationPurpose.REGISTRATION,
      code: input.code,
      notFoundMessage: 'No encontramos un codigo vigente para este telefono.',
      expiredMessage: 'El codigo de confirmacion ha expirado.',
      invalidMessage: 'El codigo de confirmacion no es valido.',
    });

    await this.prisma.$transaction([
      this.prisma.phoneVerificationCode.update({
        where: { id: verificationCode.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          phoneVerifiedAt: new Date(),
          status: UserStatus.ACTIVE,
        },
      }),
      this.prisma.wallet.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      }),
    ]);

    return {
      message: 'Telefono confirmado correctamente.',
    };
  }

  async resendPhoneCode(input: ResendPhoneCodeDto) {
    const phoneCountryCode = normalizeText(input.phoneCountryCode);
    const phoneNumber = normalizeText(input.phoneNumber);
    const user = await this.findUserByPhone(phoneCountryCode, phoneNumber);

    if (!user) {
      throw notFound('USER_NOT_FOUND', 'No encontramos un usuario con ese telefono.');
    }

    if (user.phoneVerifiedAt) {
      return {
        message: 'El telefono ya esta confirmado.',
      };
    }

    await this.createAndSendPhoneCode({
      userId: user.id,
      phoneCountryCode,
      phoneNumber,
      purpose: PhoneVerificationPurpose.REGISTRATION,
    });

    return {
      message: 'Te enviamos un nuevo codigo de confirmacion.',
    };
  }

  async login(input: LoginDto) {
    const phoneCountryCode = normalizeText(input.phoneCountryCode);
    const phoneNumber = normalizeText(input.phoneNumber);
    const user = await this.findUserByPhone(phoneCountryCode, phoneNumber);

    if (!user) {
      throw unauthorized('INVALID_CREDENTIALS', 'El telefono o la contrasena no son correctos.');
    }

    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);

    if (!isValidPassword) {
      throw unauthorized('INVALID_CREDENTIALS', 'El telefono o la contrasena no son correctos.');
    }

    this.assertUserCanAuthenticate(user);

    const authTokens = await this.issueAuthTokens(user);

    return {
      message: 'Inicio de sesion correcto.',
      user: this.toPublicUser(user),
      auth: authTokens,
    };
  }

  async refresh(input: RefreshTokenDto) {
    const payload = await this.verifyRefreshPayload(input.refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt.getTime() < Date.now()) {
      throw unauthorized('INVALID_REFRESH_TOKEN', 'El refresh token no es valido.');
    }

    const isSameToken = await bcrypt.compare(input.refreshToken, storedToken.tokenHash);

    if (!isSameToken) {
      throw unauthorized('INVALID_REFRESH_TOKEN', 'El refresh token no es valido.');
    }

    this.assertUserCanAuthenticate(storedToken.user);

    const authTokens = await this.issueAuthTokens(storedToken.user);

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return {
      message: 'Token renovado correctamente.',
      auth: authTokens,
    };
  }

  async logout(input: LogoutDto) {
    const payload = await this.verifyRefreshPayload(input.refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!storedToken) {
      throw unauthorized('INVALID_REFRESH_TOKEN', 'El refresh token no es valido.');
    }

    const isSameToken = await bcrypt.compare(input.refreshToken, storedToken.tokenHash);

    if (!isSameToken) {
      throw unauthorized('INVALID_REFRESH_TOKEN', 'El refresh token no es valido.');
    }

    if (!storedToken.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
    }

    return {
      message: 'Sesion cerrada correctamente.',
    };
  }

  async requestPasswordReset(input: RequestPasswordResetDto) {
    const phoneCountryCode = normalizeText(input.phoneCountryCode);
    const phoneNumber = normalizeText(input.phoneNumber);
    const user = await this.findUserByPhone(phoneCountryCode, phoneNumber);

    if (!user) {
      throw notFound('USER_NOT_FOUND', 'No encontramos un usuario con ese telefono.');
    }

    if (!user.phoneVerifiedAt) {
      throw badRequest(
        'PHONE_NOT_CONFIRMED',
        'Debes confirmar tu telefono antes de recuperar tu contrasena.',
      );
    }

    await this.createAndSendPhoneCode({
      userId: user.id,
      phoneCountryCode,
      phoneNumber,
      purpose: PhoneVerificationPurpose.ACCOUNT_RECOVERY,
    });

    return {
      message: 'Te enviamos un codigo para recuperar tu contrasena.',
    };
  }

  async resetPassword(input: ResetPasswordDto) {
    const phoneCountryCode = normalizeText(input.phoneCountryCode);
    const phoneNumber = normalizeText(input.phoneNumber);
    const user = await this.findUserByPhone(phoneCountryCode, phoneNumber);

    if (!user) {
      throw notFound('USER_NOT_FOUND', 'No encontramos un usuario con ese telefono.');
    }

    const verificationCode = await this.validatePhoneCode({
      userId: user.id,
      purpose: PhoneVerificationPurpose.ACCOUNT_RECOVERY,
      code: input.code,
      notFoundMessage: 'No encontramos un codigo vigente para recuperar la contrasena.',
      expiredMessage: 'El codigo de recuperacion ha expirado.',
      invalidMessage: 'El codigo de recuperacion no es valido.',
    });

    const passwordHash = await bcrypt.hash(input.newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.phoneVerificationCode.update({
        where: { id: verificationCode.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Contrasena actualizada correctamente.',
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw unauthorized('INVALID_ACCESS_TOKEN', 'El token de acceso no es valido.');
    }

    return {
      message: 'Usuario autenticado obtenido correctamente.',
      user: this.toPublicUser(user),
    };
  }

  private async issueAuthTokens(user: User) {
    const refreshTokenId = randomUUID();
    const authTokens = await this.tokens.generateAuthTokens({
      userId: user.id,
      role: user.role,
      refreshTokenId,
    });

    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId: user.id,
        tokenHash: await bcrypt.hash(authTokens.refreshToken, 12),
        expiresAt: this.tokens.getRefreshTokenExpiresAt(),
      },
    });

    return authTokens;
  }

  private async verifyRefreshPayload(refreshToken: string) {
    try {
      const payload = await this.tokens.verifyRefreshToken(refreshToken);

      if (payload.type !== 'refresh' || !payload.jti) {
        throw new Error('Invalid refresh token payload');
      }

      return payload;
    } catch {
      throw unauthorized('INVALID_REFRESH_TOKEN', 'El refresh token no es valido.');
    }
  }

  private async createAndSendPhoneCode(input: {
    userId: string;
    phoneCountryCode: string;
    phoneNumber: string;
    purpose: PhoneVerificationPurpose;
  }): Promise<void> {
    const code = this.verificationCodes.generateNumericCode();
    const codeHash = await this.verificationCodes.hash(code);
    const expiresAt = addMinutes(new Date(), PHONE_CODE_EXPIRATION_MINUTES);

    await this.prisma.$transaction([
      this.prisma.phoneVerificationCode.updateMany({
        where: {
          userId: input.userId,
          purpose: input.purpose,
          consumedAt: null,
        },
        data: {
          consumedAt: new Date(),
        },
      }),
      this.prisma.phoneVerificationCode.create({
        data: {
          userId: input.userId,
          phoneCountryCode: input.phoneCountryCode,
          phoneNumber: input.phoneNumber,
          codeHash,
          purpose: input.purpose,
          expiresAt,
        },
      }),
    ]);

    const notificationInput = {
      phoneCountryCode: input.phoneCountryCode,
      phoneNumber: input.phoneNumber,
      code,
      expirationMinutes: PHONE_CODE_EXPIRATION_MINUTES,
    };

    if (input.purpose === PhoneVerificationPurpose.ACCOUNT_RECOVERY) {
      await this.notifications.sendPasswordRecoveryCode(notificationInput);
      return;
    }

    await this.notifications.sendPhoneVerificationCode(notificationInput);
  }

  private async validatePhoneCode(input: {
    userId: string;
    purpose: PhoneVerificationPurpose;
    code: string;
    notFoundMessage: string;
    expiredMessage: string;
    invalidMessage: string;
  }) {
    const verificationCode = await this.prisma.phoneVerificationCode.findFirst({
      where: {
        userId: input.userId,
        purpose: input.purpose,
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verificationCode) {
      throw badRequest('PHONE_CODE_NOT_FOUND', input.notFoundMessage);
    }

    if (verificationCode.expiresAt.getTime() < Date.now()) {
      throw badRequest('PHONE_CODE_EXPIRED', input.expiredMessage);
    }

    if (verificationCode.attempts >= MAX_PHONE_CODE_ATTEMPTS) {
      throw badRequest(
        'PHONE_CODE_ATTEMPTS_EXCEEDED',
        'Superaste el numero maximo de intentos. Solicita un nuevo codigo.',
      );
    }

    const isValidCode = await this.verificationCodes.compare(input.code, verificationCode.codeHash);

    if (!isValidCode) {
      await this.prisma.phoneVerificationCode.update({
        where: { id: verificationCode.id },
        data: { attempts: { increment: 1 } },
      });

      throw badRequest('INVALID_PHONE_CODE', input.invalidMessage);
    }

    return verificationCode;
  }

  private findUserByPhone(phoneCountryCode: string, phoneNumber: string) {
    return this.prisma.user.findUnique({
      where: {
        phoneCountryCode_phoneNumber: {
          phoneCountryCode,
          phoneNumber,
        },
      },
    });
  }

  private assertUserCanAuthenticate(user: User) {
    if (!user.phoneVerifiedAt || user.status === UserStatus.PENDING_PHONE_CONFIRMATION) {
      throw unauthorized(
        'PHONE_NOT_CONFIRMED',
        'Debes confirmar tu telefono antes de iniciar sesion.',
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw unauthorized('USER_NOT_ACTIVE', 'Tu usuario no se encuentra activo.');
    }
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      phoneCountryCode: user.phoneCountryCode,
      phoneNumber: user.phoneNumber,
      email: user.email,
      fullName: user.fullName,
      profileImage: buildMediaUrl(user.profileImageUrl, this.config),
      profileImageObjectKey: user.profileImageUrl,
      role: user.role,
      status: user.status,
    };
  }
}

const normalizeText = (value: string): string => value.trim();

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * 60 * 1000);
