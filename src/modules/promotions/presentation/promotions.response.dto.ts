import { ApiProperty } from '@nestjs/swagger';
import {
  PromotionDiscountType,
  PromotionItemType,
  PromotionPricingMode,
  PromotionStatus,
} from '@prisma/client';

export class PromotionClubDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;
}

export class PromotionEventDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  endsAt!: Date;
}

export class PromotionProductDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'number' })
  price!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;
}

export class PromotionTicketTypeDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'number' })
  price!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;
}

export class PromotionItemResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: PromotionItemType, enumName: 'PromotionItemType' })
  itemType!: PromotionItemType;

  @ApiProperty({ type: 'string', nullable: true })
  productId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  ticketTypeId!: string | null;

  @ApiProperty({ type: 'integer' })
  quantity!: number;

  @ApiProperty({ type: 'number' })
  baseUnitPrice!: number;

  @ApiProperty({ enum: PromotionDiscountType, enumName: 'PromotionDiscountType' })
  discountType!: PromotionDiscountType;

  @ApiProperty({ type: 'number' })
  discountValue!: number;

  @ApiProperty({ type: 'number' })
  discountedUnitPrice!: number;

  @ApiProperty({ type: 'number' })
  lineBaseTotal!: number;

  @ApiProperty({ type: 'number' })
  lineFinalTotal!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: () => PromotionProductDto, nullable: true })
  product!: PromotionProductDto | null;

  @ApiProperty({ type: () => PromotionTicketTypeDto, nullable: true })
  ticketType!: PromotionTicketTypeDto | null;
}

export class PromotionDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string' })
  scope!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  imageObjectKey!: string | null;

  @ApiProperty({ enum: PromotionPricingMode, enumName: 'PromotionPricingMode' })
  pricingMode!: PromotionPricingMode;

  @ApiProperty({ type: 'number' })
  basePrice!: number;

  @ApiProperty({ type: 'number' })
  finalPrice!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ enum: PromotionStatus, enumName: 'PromotionStatus' })
  status!: PromotionStatus;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  startsAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  endsAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: () => PromotionClubDto })
  club!: PromotionClubDto;

  @ApiProperty({ type: () => PromotionEventDto, nullable: true })
  event!: PromotionEventDto | null;

  @ApiProperty({ type: () => [PromotionItemResponseDto] })
  items!: PromotionItemResponseDto[];
}

export class PromotionResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => PromotionDto })
  promotion!: PromotionDto;
}

export class PromotionsResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => [PromotionDto] })
  promotions!: PromotionDto[];
}
