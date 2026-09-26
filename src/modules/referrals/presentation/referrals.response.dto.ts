import { ApiProperty } from '@nestjs/swagger';
import {
  ReferralCaptureMethod,
  ReferralExpirationMode,
  ReferralRewardStatus,
  WalletTransferStatus,
} from '@prisma/client';
import { PaginationDto } from '../../../shared/presentation/response.dto';

export class ReferralOverviewProgramDto {
  @ApiProperty({ type: 'boolean' })
  enabled!: boolean;

  @ApiProperty({ type: 'integer' })
  rewardBps!: number;

  @ApiProperty({ type: 'boolean' })
  transfersEnabled!: boolean;

  @ApiProperty({ type: 'integer' })
  associationWindowDays!: number;
}

export class ReferrerDto {
  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  associatedAt!: Date;
}

export class ReferredUserDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  associatedAt!: Date;

  @ApiProperty({ type: 'boolean' })
  hasPurchased!: boolean;
}

export class ReferralRewardSummaryDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: ReferralRewardStatus, enumName: 'ReferralRewardStatus' })
  status!: ReferralRewardStatus;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({ type: 'string' })
  orderId!: string;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'integer' })
  platformCommissionBps!: number;

  @ApiProperty({ type: 'integer' })
  rewardBps!: number;

  @ApiProperty({ type: 'string' })
  referralId!: string;

  @ApiProperty({ type: 'string' })
  beneficiaryUserId!: string;

  @ApiProperty({ type: 'string' })
  buyerUserId!: string;

  @ApiProperty({ type: 'integer' })
  eligibleBaseCents!: number;

  @ApiProperty({ type: 'integer' })
  settingsVersion!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  availableAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  availableSince!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  reversedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  reversalReason!: string | null;
}

export class ReferralOverviewSummaryDto {
  @ApiProperty({ type: 'integer' })
  referredUsers!: number;

  @ApiProperty({ type: 'integer' })
  pendingCents!: number;

  @ApiProperty({ type: 'integer' })
  earnedCents!: number;

  @ApiProperty({ type: 'integer' })
  availableCents!: number;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  nextExpiration!: Date | null;
}

export class ReferralOverviewResponseDto {
  @ApiProperty({ type: 'string' })
  code!: string;

  @ApiProperty({ type: 'string' })
  shareUrl!: string;

  @ApiProperty({ type: () => ReferralOverviewProgramDto })
  program!: ReferralOverviewProgramDto;

  @ApiProperty({ type: () => ReferrerDto, nullable: true })
  referredBy!: ReferrerDto | null;

  @ApiProperty({ type: () => [ReferredUserDto] })
  referrals!: ReferredUserDto[];

  @ApiProperty({ type: () => [ReferralRewardSummaryDto] })
  rewards!: ReferralRewardSummaryDto[];

  @ApiProperty({ type: () => ReferralOverviewSummaryDto })
  summary!: ReferralOverviewSummaryDto;
}

export class ReferralPreviewResponseDto {
  @ApiProperty({ type: 'string' })
  code!: string;

  @ApiProperty({ type: 'string' })
  referrerName!: string;
}

export class ReferralAssociationResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ enum: ReferralCaptureMethod, enumName: 'ReferralCaptureMethod' })
  captureMethod!: ReferralCaptureMethod;

  @ApiProperty({ type: 'string' })
  referredUserId!: string;

  @ApiProperty({ type: 'string' })
  referrerUserId!: string;

  @ApiProperty({ type: 'string' })
  codeSnapshot!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  associatedAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  lockedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  firstPaidOrderId!: string | null;
}

export class ReferralTransferResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: WalletTransferStatus, enumName: 'WalletTransferStatus' })
  status!: WalletTransferStatus;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'string' })
  idempotencyKey!: string;

  @ApiProperty({ type: 'string', nullable: true })
  note!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: 'string' })
  fromWalletId!: string;

  @ApiProperty({ type: 'string' })
  toWalletId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  rejectedReason!: string | null;
}

export class ReferralSettingsResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'integer' })
  version!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'boolean' })
  enabled!: boolean;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  startsAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  endsAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  updatedByUserId!: string | null;

  @ApiProperty({ type: 'integer' })
  platformCommissionBps!: number;

  @ApiProperty({ type: 'integer' })
  rewardBps!: number;

  @ApiProperty({ type: 'integer' })
  minimumPlatformMarginBps!: number;

  @ApiProperty({ type: 'integer' })
  minimumPurchaseCents!: number;

  @ApiProperty({ type: 'integer', nullable: true })
  maximumRewardPerOrderCents!: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  maximumMonthlyRewardCents!: number | null;

  @ApiProperty({ type: 'integer' })
  holdHours!: number;

  @ApiProperty({ enum: ReferralExpirationMode, enumName: 'ReferralExpirationMode' })
  expirationMode!: ReferralExpirationMode;

  @ApiProperty({ type: 'integer', nullable: true })
  expirationDays!: number | null;

  @ApiProperty({ type: 'integer' })
  associationWindowDays!: number;

  @ApiProperty({ type: 'integer' })
  maxCreditUsageBps!: number;

  @ApiProperty({ type: 'boolean' })
  transfersEnabled!: boolean;

  @ApiProperty({ type: 'integer', nullable: true })
  maxDailyTransferCents!: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  maxMonthlyTransferCents!: number | null;
}

export class ReferralRewardOrderDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'integer' })
  totalCents!: number;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  paidAt!: Date | null;
}

export class ReferralRewardUserDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  fullName!: string;
}

export class ReferralRewardDto {
  @ApiProperty({ type: () => ReferralRewardOrderDto })
  order!: ReferralRewardOrderDto;

  @ApiProperty({ type: () => ReferralRewardUserDto })
  beneficiary!: ReferralRewardUserDto;

  @ApiProperty({ type: () => ReferralRewardUserDto })
  buyer!: ReferralRewardUserDto;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: ReferralRewardStatus, enumName: 'ReferralRewardStatus' })
  status!: ReferralRewardStatus;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({ type: 'string' })
  orderId!: string;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'integer' })
  platformCommissionBps!: number;

  @ApiProperty({ type: 'integer' })
  rewardBps!: number;

  @ApiProperty({ type: 'string' })
  referralId!: string;

  @ApiProperty({ type: 'string' })
  beneficiaryUserId!: string;

  @ApiProperty({ type: 'string' })
  buyerUserId!: string;

  @ApiProperty({ type: 'integer' })
  eligibleBaseCents!: number;

  @ApiProperty({ type: 'integer' })
  settingsVersion!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  availableAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  availableSince!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  reversedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  reversalReason!: string | null;
}

export class ReferralRewardsSummaryDto {
  @ApiProperty({ type: 'integer' })
  rewardsCents!: number;

  @ApiProperty({ type: 'integer' })
  eligibleSalesCents!: number;
}

export class ReferralRewardsResponseDto {
  @ApiProperty({ type: () => [ReferralRewardDto] })
  items!: ReferralRewardDto[];

  @ApiProperty({ type: () => ReferralRewardsSummaryDto })
  summary!: ReferralRewardsSummaryDto;

  @ApiProperty({ type: () => PaginationDto })
  pagination!: PaginationDto;
}
