import { IsInteger, OptionalField } from '../../../shared/presentation/dto-fields';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsBoolean,
  IsEnum,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReferralCaptureMethod, ReferralExpirationMode, ReferralRewardStatus } from '@prisma/client';

export class AssociateReferralDto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @OptionalField()
  @IsEnum(ReferralCaptureMethod)
  captureMethod?: ReferralCaptureMethod;
}

export class UpdateReferralSettingsDto {
  @OptionalField() @IsBoolean() enabled?: boolean;
  @OptionalField()
  @Type(() => Number)
  @IsInteger()
  @Min(0)
  @Max(10000)
  platformCommissionBps?: number;
  @OptionalField() @Type(() => Number) @IsInteger() @Min(0) @Max(10000) rewardBps?: number;
  @OptionalField()
  @Type(() => Number)
  @IsInteger()
  @Min(0)
  @Max(10000)
  minimumPlatformMarginBps?: number;
  @OptionalField() @Type(() => Number) @IsInteger() @Min(0) minimumPurchaseCents?: number;
  @OptionalField({ nullable: true, type: 'integer' })
  @Type(() => Number)
  @IsInteger()
  @Min(1)
  maximumRewardPerOrderCents?: number | null;
  @OptionalField({ nullable: true, type: 'integer' })
  @Type(() => Number)
  @IsInteger()
  @Min(1)
  maximumMonthlyRewardCents?: number | null;
  @OptionalField() @Type(() => Number) @IsInteger() @Min(0) @Max(720) holdHours?: number;
  @OptionalField() @IsEnum(ReferralExpirationMode) expirationMode?: ReferralExpirationMode;
  @OptionalField({ nullable: true, type: 'integer' })
  @Type(() => Number)
  @IsInteger()
  @Min(1)
  @Max(3650)
  expirationDays?: number | null;
  @OptionalField()
  @Type(() => Number)
  @IsInteger()
  @Min(0)
  @Max(365)
  associationWindowDays?: number;
  @OptionalField() @Type(() => Number) @IsInteger() @Min(0) @Max(10000) maxCreditUsageBps?: number;
  @OptionalField() @IsBoolean() transfersEnabled?: boolean;
  @OptionalField({ nullable: true, type: 'integer' })
  @Type(() => Number)
  @IsInteger()
  @Min(1)
  maxDailyTransferCents?: number | null;
  @OptionalField({ nullable: true, type: 'integer' })
  @Type(() => Number)
  @IsInteger()
  @Min(1)
  maxMonthlyTransferCents?: number | null;
  @OptionalField({ nullable: true, type: String, format: 'date-time' }) @IsDateString() startsAt?: string | null;
  @OptionalField({ nullable: true, type: String, format: 'date-time' }) @IsDateString() endsAt?: string | null;
}

export class TransferCreditDto {
  @IsString()
  phoneCountryCode!: string;

  @Matches(/^\d{6,15}$/)
  phoneNumber!: string;

  @Type(() => Number)
  @IsInteger()
  @Min(1)
  amountCents!: number;

  @IsString()
  @MaxLength(100)
  idempotencyKey!: string;

  @OptionalField()
  @IsString()
  @MaxLength(160)
  note?: string;
}

export class ReferralAdminQueryDto {
  @OptionalField({ enum: ReferralRewardStatus }) @IsEnum(ReferralRewardStatus) status?: ReferralRewardStatus;
  @OptionalField() @IsString() search?: string;
  @OptionalField() @Type(() => Number) @IsInteger() @Min(1) page = 1;
  @OptionalField() @Type(() => Number) @IsInteger() @Min(1) @Max(100) pageSize = 20;
}
