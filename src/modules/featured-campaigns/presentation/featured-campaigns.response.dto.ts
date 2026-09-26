import { ApiProperty } from '@nestjs/swagger';
import { FeaturedCampaignStatus, FeaturedTargetType, PaymentAttemptStatus } from '@prisma/client';

export class FeaturedCampaignOfferDto {
  @ApiProperty({ enum: FeaturedTargetType, enumName: 'FeaturedTargetType' })
  targetType!: FeaturedTargetType;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'integer', nullable: true })
  dailyPriceCents!: number | null;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'boolean' })
  configured!: boolean;
}

export class FeaturedCampaignEventDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  endsAt!: Date;
}

export class FeaturedCampaignDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: FeaturedTargetType, enumName: 'FeaturedTargetType' })
  targetType!: FeaturedTargetType;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  eventName!: string | null;

  @ApiProperty({ enum: FeaturedCampaignStatus, enumName: 'FeaturedCampaignStatus' })
  status!: FeaturedCampaignStatus;

  @ApiProperty({ type: 'integer' })
  durationDays!: number;

  @ApiProperty({ type: 'integer' })
  priceCents!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  startsAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  endsAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ enum: PaymentAttemptStatus, enumName: 'PaymentAttemptStatus', nullable: true })
  paymentStatus!: PaymentAttemptStatus | null;
}

export class FeaturedCampaignManagementResponseDto {
  @ApiProperty({ type: () => [FeaturedCampaignOfferDto] })
  offers!: FeaturedCampaignOfferDto[];

  @ApiProperty({ type: () => [FeaturedCampaignEventDto] })
  events!: FeaturedCampaignEventDto[];

  @ApiProperty({ type: () => [FeaturedCampaignDto] })
  campaigns!: FeaturedCampaignDto[];
}

export class FeaturedCampaignPaymentDto {
  @ApiProperty({ type: 'string', nullable: true })
  provider!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  paymentAttemptId!: string | null;

  @ApiProperty({ enum: PaymentAttemptStatus, enumName: 'PaymentAttemptStatus', nullable: true })
  status!: PaymentAttemptStatus | null;

  @ApiProperty({ type: 'string', nullable: true })
  checkoutUrl!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  failureCode!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  failureMessage!: string | null;
}

export class FeaturedCampaignCheckoutResponseDto {
  @ApiProperty({ type: () => FeaturedCampaignDto })
  campaign!: FeaturedCampaignDto;

  @ApiProperty({ type: () => FeaturedCampaignPaymentDto })
  payment!: FeaturedCampaignPaymentDto;
}
