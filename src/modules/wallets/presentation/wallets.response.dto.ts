import { ApiProperty } from '@nestjs/swagger';
import {
  CommerceItemType,
  EventBuyerRefundStatus,
  EventRefundJobStatus,
  EventStatus,
  OrderPaymentMethod,
  OrderStatus,
  WalletMovementStatus,
  WalletMovementType,
  WalletTopUpStatus,
} from '@prisma/client';

export class WalletCreditExpiryDto {
  @ApiProperty({ type: 'number' })
  amount!: number;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  expiresAt!: Date | null;
}

export class WalletCreditDto {
  @ApiProperty({ type: 'number' })
  available!: number;

  @ApiProperty({ type: () => WalletCreditExpiryDto, nullable: true })
  nextToExpire!: WalletCreditExpiryDto | null;
}

export class WalletTopUpSummaryDto {
  @ApiProperty({ type: 'number' })
  amount!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;
}

export class WalletMovementDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: WalletMovementType, enumName: 'WalletMovementType' })
  type!: WalletMovementType;

  @ApiProperty({ enum: WalletMovementStatus, enumName: 'WalletMovementStatus' })
  status!: WalletMovementStatus;

  @ApiProperty({ type: 'number' })
  amount!: number;

  @ApiProperty({ type: 'string' })
  description!: string;

  @ApiProperty({ type: 'string', nullable: true })
  referenceId!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  completedAt!: Date | null;
}

export class WalletStatDto {
  @ApiProperty({ type: 'integer' })
  purchases!: number;

  @ApiProperty({ type: 'integer' })
  activeQr!: number;
}

export class WalletResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'number' })
  balance!: number;

  @ApiProperty({ type: 'number' })
  totalSpent!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: () => WalletCreditDto })
  credit!: WalletCreditDto;

  @ApiProperty({ type: () => WalletTopUpSummaryDto, nullable: true })
  lastTopUp!: WalletTopUpSummaryDto | null;

  @ApiProperty({ type: () => [WalletMovementDto] })
  movements!: WalletMovementDto[];

  @ApiProperty({ type: () => WalletStatDto })
  stats!: WalletStatDto;
}

export class OrderRefundExecutionDto {
  @ApiProperty({ enum: EventRefundJobStatus, enumName: 'EventRefundJobStatus' })
  status!: EventRefundJobStatus;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;
}

export class OrderReplacementOfferDto {
  @ApiProperty({ type: 'string' })
  cancellationId!: string;

  @ApiProperty({ type: 'string' })
  targetName!: string;

  @ApiProperty({ type: 'string' })
  eventName!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  endsAt!: Date;
}

export class WalletReplacementEventDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) name!: string;
  @ApiProperty({ enum: EventStatus, enumName: 'EventStatus' }) status!: EventStatus;
  @ApiProperty({ type: 'string', format: 'date-time' }) startsAt!: Date;
  @ApiProperty({ type: 'string', format: 'date-time' }) endsAt!: Date;
}
export class WalletEventNoticeDto {
  @ApiProperty({ type: 'string' })
  eventName!: string;

  @ApiProperty({ type: 'string' })
  message!: string;
  @ApiProperty({ type: () => WalletReplacementEventDto, nullable: true })
  replacement!: WalletReplacementEventDto | null;
}

export class WalletMovementResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ enum: WalletMovementStatus, enumName: 'WalletMovementStatus' })
  status!: WalletMovementStatus;

  @ApiProperty({ enum: WalletMovementType, enumName: 'WalletMovementType' })
  type!: WalletMovementType;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'string' })
  description!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: () => WalletMovementRelatedDto, nullable: true })
  related!: WalletMovementRelatedDto | null;
}

export class WalletOrderDetailItemDto {
  @ApiProperty({ enum: EventBuyerRefundStatus, enumName: 'EventBuyerRefundStatus', nullable: true })
  replacementRefundStatus!: EventBuyerRefundStatus | null;

  @ApiProperty({ type: () => OrderRefundExecutionDto, nullable: true })
  refundExecution!: OrderRefundExecutionDto | null;

  @ApiProperty({ type: () => OrderReplacementOfferDto, nullable: true })
  replacementOffer!: OrderReplacementOfferDto | null;

  @ApiProperty({ type: 'boolean' })
  canRequestReplacementRefund!: boolean;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'integer' })
  quantity!: number;

  @ApiProperty({ type: 'integer' })
  totalCents!: number;

  @ApiProperty({ enum: CommerceItemType, enumName: 'CommerceItemType' })
  itemType!: CommerceItemType;

  @ApiProperty({ type: 'string' })
  nameSnapshot!: string;

  @ApiProperty({ type: 'integer' })
  unitPriceCents!: number;
}

export class WalletOrderDetailResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status!: OrderStatus;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ enum: OrderPaymentMethod, enumName: 'OrderPaymentMethod' })
  paymentMethod!: OrderPaymentMethod;

  @ApiProperty({ type: 'string' })
  business!: string;

  @ApiProperty({ type: () => [WalletOrderDetailItemDto] })
  items!: WalletOrderDetailItemDto[];

  @ApiProperty({ type: () => [WalletEventNoticeDto] })
  eventNotices!: WalletEventNoticeDto[];
}

export class WalletTopUpDetailItemDto {
  @ApiProperty({ type: 'string' })
  nameSnapshot!: string;

  @ApiProperty({ type: 'integer' })
  quantity!: number;

  @ApiProperty({ type: 'integer' })
  totalCents!: number;
}

export class WalletTopUpDetailResponseDto {
  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string' })
  paymentMethod!: string;

  @ApiProperty({ type: () => [WalletTopUpDetailItemDto] })
  items!: WalletTopUpDetailItemDto[];

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ enum: WalletTopUpStatus, enumName: 'WalletTopUpStatus' })
  status!: WalletTopUpStatus;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  approvedAt!: Date | null;
}

export class WalletMovementRelatedDto {
  @ApiProperty({ type: () => WalletOrderDetailResponseDto, nullable: true })
  order!: WalletOrderDetailResponseDto | null;
  @ApiProperty({ type: () => WalletTopUpDetailResponseDto, nullable: true })
  topUp!: WalletTopUpDetailResponseDto | null;
}
