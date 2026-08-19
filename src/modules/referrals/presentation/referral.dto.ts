import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ReferralCaptureMethod, ReferralExpirationMode } from '@prisma/client';

export class AssociateReferralDto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @IsOptional()
  @IsEnum(ReferralCaptureMethod)
  captureMethod?: ReferralCaptureMethod;
}

export class UpdateReferralSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) platformCommissionBps?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) rewardBps?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) minimumPlatformMarginBps?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minimumPurchaseCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maximumRewardPerOrderCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maximumMonthlyRewardCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(720) holdHours?: number;
  @IsOptional() @IsEnum(ReferralExpirationMode) expirationMode?: ReferralExpirationMode;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) expirationDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) associationWindowDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) maxCreditUsageBps?: number;
  @IsOptional() @IsBoolean() transfersEnabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxDailyTransferCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxMonthlyTransferCents?: number;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
}

export class TransferCreditDto {
  @IsString()
  phoneCountryCode!: string;

  @Matches(/^\d{6,15}$/)
  phoneNumber!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsString()
  @MaxLength(100)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  note?: string;
}

export class ReferralAdminQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
