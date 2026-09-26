import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

export class UserProfileDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  phoneCountryCode!: string;

  @ApiProperty({ type: 'string' })
  phoneNumber!: string;

  @ApiProperty({ type: 'string', nullable: true })
  email!: string | null;

  @ApiProperty({ type: 'string' })
  fullName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  profileImage!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  profileImageObjectKey!: string | null;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status!: UserStatus;
}

export class UserProfileResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => UserProfileDto })
  user!: UserProfileDto;
}

export class AuthTokensDto {
  @ApiProperty({ type: 'string' })
  accessToken!: string;

  @ApiProperty({ type: 'string' })
  refreshToken!: string;

  @ApiProperty({ type: 'string' })
  tokenType!: string;

  @ApiProperty({ type: 'string' })
  accessExpiresIn!: string;

  @ApiProperty({ type: 'string' })
  refreshExpiresIn!: string;
}

export class LoginResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => UserProfileDto })
  user!: UserProfileDto;

  @ApiProperty({ type: () => AuthTokensDto })
  auth!: AuthTokensDto;
}

export class RefreshTokenResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => AuthTokensDto })
  auth!: AuthTokensDto;
}
