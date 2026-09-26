import { ApiProperty } from '@nestjs/swagger';
import {
  CommerceItemType,
  EventStatus,
  PromotionPricingMode,
  PromotionStatus,
  RedeemableStatus,
  TicketTypeStatus,
} from '@prisma/client';
import { ClubRecordDto } from '../../clubs/presentation/club-record.response.dto';
import { OperationsLowStockDto } from './commerce.response.dto';

export class OwnedResourceEventDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ enum: EventStatus, enumName: 'EventStatus' })
  status!: EventStatus;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  endsAt!: Date;

  @ApiProperty({ type: 'integer' })
  capacity!: number;
}

export class OwnedTicketTypeDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ enum: TicketTypeStatus, enumName: 'TicketTypeStatus' })
  status!: TicketTypeStatus;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'integer' })
  priceCents!: number;

  @ApiProperty({ type: 'integer' })
  quantityTotal!: number;

  @ApiProperty({ type: 'integer' })
  quantitySold!: number;

  @ApiProperty({ type: 'integer' })
  replacementReserved!: number;

  @ApiProperty({ type: 'integer', nullable: true })
  perUserLimit!: number | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  saleStartAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  saleEndAt!: Date | null;
}

export class OwnedTicketDto {
  @ApiProperty({ type: () => ClubRecordDto })
  club!: ClubRecordDto;

  @ApiProperty({ type: () => OwnedResourceEventDto, nullable: true })
  event!: OwnedResourceEventDto | null;

  @ApiProperty({ type: () => OwnedTicketTypeDto })
  ticketType!: OwnedTicketTypeDto;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ enum: RedeemableStatus, enumName: 'RedeemableStatus' })
  status!: RedeemableStatus;

  @ApiProperty({ type: 'string' })
  code!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  revokedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  orderId!: string;

  @ApiProperty({ type: 'string' })
  qrPayload!: string;

  @ApiProperty({ type: 'string' })
  signatureVersion!: string;

  @ApiProperty({ type: 'integer' })
  redemptionCount!: number;

  @ApiProperty({ type: 'integer' })
  maxRedemptions!: number;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  validFrom!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  validUntil!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  usedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  revokedReason!: string | null;

  @ApiProperty({ type: 'string' })
  orderItemId!: string;

  @ApiProperty({ type: 'string' })
  ticketTypeId!: string;

  @ApiProperty({ type: 'string' })
  ownerUserId!: string;
}

export class OwnedTicketsResponseDto {
  @ApiProperty({ type: () => [OwnedTicketDto] })
  items!: OwnedTicketDto[];
}

export class OwnedConsumablePromotionDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ enum: PromotionStatus, enumName: 'PromotionStatus' })
  status!: PromotionStatus;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  startsAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  endsAt!: Date | null;

  @ApiProperty({ enum: PromotionPricingMode, enumName: 'PromotionPricingMode' })
  pricingMode!: PromotionPricingMode;

  @ApiProperty({ type: 'integer' })
  basePriceCents!: number;

  @ApiProperty({ type: 'integer' })
  finalPriceCents!: number;
}

export class ConsumableContentDto {
  @ApiProperty({ type: 'string' })
  productId!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'integer' })
  quantity!: number;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;
}

export class DeliveryItemDto {
  @ApiProperty({ type: () => OperationsLowStockDto })
  product!: OperationsLowStockDto;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'integer' })
  quantity!: number;

  @ApiProperty({ type: 'string' })
  productId!: string;

  @ApiProperty({ type: 'string' })
  orderItemId!: string;

  @ApiProperty({ type: 'string' })
  nameSnapshot!: string;

  @ApiProperty({ type: 'string' })
  productDeliveryId!: string;
}

export class OwnedConsumableRightDto {
  @ApiProperty({ type: () => ClubRecordDto })
  club!: ClubRecordDto;

  @ApiProperty({ type: () => OwnedResourceEventDto, nullable: true })
  event!: OwnedResourceEventDto | null;

  @ApiProperty({ type: () => OperationsLowStockDto, nullable: true })
  product!: OperationsLowStockDto | null;

  @ApiProperty({ type: () => OwnedConsumablePromotionDto, nullable: true })
  promotion!: OwnedConsumablePromotionDto | null;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ enum: RedeemableStatus, enumName: 'RedeemableStatus' })
  status!: RedeemableStatus;

  @ApiProperty({ type: 'string' })
  code!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  revokedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  orderId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  productId!: string | null;

  @ApiProperty({ type: 'string' })
  qrPayload!: string;

  @ApiProperty({ type: 'string' })
  signatureVersion!: string;

  @ApiProperty({ type: 'integer' })
  redemptionCount!: number;

  @ApiProperty({ type: 'integer' })
  maxRedemptions!: number;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  validFrom!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  validUntil!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  usedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  revokedReason!: string | null;

  @ApiProperty({ type: 'string' })
  orderItemId!: string;

  @ApiProperty({ type: 'string' })
  ownerUserId!: string;

  @ApiProperty({ enum: CommerceItemType, enumName: 'CommerceItemType' })
  sourceType!: CommerceItemType;

  @ApiProperty({ type: 'string' })
  sourceId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  promotionId!: string | null;
}

export class OwnedProductDeliveryDto {
  @ApiProperty({ type: () => ClubRecordDto })
  club!: ClubRecordDto;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ enum: RedeemableStatus, enumName: 'RedeemableStatus' })
  status!: RedeemableStatus;

  @ApiProperty({ type: 'string' })
  code!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  revokedAt!: Date | null;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  orderId!: string;

  @ApiProperty({ type: 'string' })
  qrPayload!: string;

  @ApiProperty({ type: 'string' })
  signatureVersion!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  usedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  revokedReason!: string | null;

  @ApiProperty({ type: 'string' })
  ownerUserId!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: () => [ConsumableContentDto] })
  contents!: ConsumableContentDto[];

  @ApiProperty({ type: () => [DeliveryItemDto] })
  items!: DeliveryItemDto[];
}

export class OwnedConsumablesResponseDto {
  @ApiProperty({ type: () => [OwnedConsumableRightDto] })
  rights!: OwnedConsumableRightDto[];
  @ApiProperty({ type: () => [OwnedProductDeliveryDto] })
  deliveries!: OwnedProductDeliveryDto[];
}
