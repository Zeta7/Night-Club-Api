import { ApiProperty } from '@nestjs/swagger';
import { MarketplaceFeeSource, Prisma, UserRole, UserStatus } from '@prisma/client';
import { PaginationDto } from '../../../shared/presentation/response.dto';

export class MarketplaceFeeResponseDto {
  @ApiProperty({ type: 'integer', nullable: true })
  defaultMarketplaceFeeBps!: number | null;

  @ApiProperty({
    enum: ['BPS', 'LEGACY_PERCENTAGE', 'NOT_CONFIGURED'],
    enumName: 'MarketplaceFeeConfigurationSource',
  })
  source!: 'BPS' | 'LEGACY_PERCENTAGE' | 'NOT_CONFIGURED';

  @ApiProperty({ type: 'integer' })
  maximumMarketplaceFeeBps!: number;
}

export class ClubMarketplaceFeeExampleDto {
  @ApiProperty({ type: 'integer' })
  grossAmountCents!: number;

  @ApiProperty({ type: 'integer' })
  marketplaceFeeCents!: number;

  @ApiProperty({ type: 'boolean' })
  excludesMercadoPagoProcessingFee!: boolean;
}

export class ClubMarketplaceFeeResponseDto {
  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  businessName!: string;

  @ApiProperty({ type: 'integer', nullable: true })
  effectiveFeeBps!: number | null;

  @ApiProperty({ enum: MarketplaceFeeSource, enumName: 'MarketplaceFeeSource' })
  feeSource!: MarketplaceFeeSource;

  @ApiProperty({ type: 'integer', nullable: true })
  businessOverrideFeeBps!: number | null;

  @ApiProperty({ type: () => ClubMarketplaceFeeExampleDto, nullable: true })
  example!: ClubMarketplaceFeeExampleDto | null;
}

export class UserStatusCountsDto {
  @ApiProperty({ type: 'integer' })
  active!: number;

  @ApiProperty({ type: 'integer' })
  inactive!: number;

  @ApiProperty({ type: 'integer' })
  blocked!: number;

  @ApiProperty({ type: 'integer' })
  pendingPhoneConfirmation!: number;
}

export class UserRoleCountsDto {
  @ApiProperty({ type: 'integer' })
  superAdmin!: number;

  @ApiProperty({ type: 'integer' })
  admin!: number;

  @ApiProperty({ type: 'integer' })
  worker!: number;

  @ApiProperty({ type: 'integer' })
  customer!: number;
}

export class PlatformUserCountsDto {
  @ApiProperty({ type: 'integer' })
  total!: number;

  @ApiProperty({ type: () => UserStatusCountsDto })
  byStatus!: UserStatusCountsDto;

  @ApiProperty({ type: () => UserRoleCountsDto })
  byRole!: UserRoleCountsDto;
}

export class PlatformDashboardDto {
  @ApiProperty({ type: () => PlatformUserCountsDto })
  users!: PlatformUserCountsDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: { allOf: [{ $ref: '#/components/schemas/JsonValue' }], nullable: true },
  })
  settings!: Prisma.JsonObject;
}

export class PlatformDashboardResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => PlatformDashboardDto })
  dashboard!: PlatformDashboardDto;
}

export class PlatformSettingsResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { allOf: [{ $ref: '#/components/schemas/JsonValue' }], nullable: true },
  })
  settings!: Prisma.JsonObject;
}

export class PlatformUserDto {
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

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status!: UserStatus;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  phoneVerifiedAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}

export class PlatformUsersResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => [PlatformUserDto] })
  users!: PlatformUserDto[];

  @ApiProperty({ type: () => PaginationDto })
  pagination!: PaginationDto;
}

export class PlatformUserResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => PlatformUserDto })
  user!: PlatformUserDto;
}
