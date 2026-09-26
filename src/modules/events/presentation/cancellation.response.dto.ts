import { ApiProperty } from '@nestjs/swagger';
import {
  EventBuyerRefundStatus,
  EventCancellationMode,
  EventCancellationStatus,
} from '@prisma/client';

export class BuyerRefundRequestDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: EventBuyerRefundStatus, enumName: 'EventBuyerRefundStatus' })
  status!: EventBuyerRefundStatus;
}

export class BuyerRefundRequestResponseDto {
  @ApiProperty({ type: () => BuyerRefundRequestDto })
  request!: BuyerRefundRequestDto;
}

export class BuyerRefundOrderItemDto {
  @ApiProperty({ type: 'integer' })
  quantity!: number;

  @ApiProperty({ type: 'integer' })
  totalCents!: number;

  @ApiProperty({ type: 'string' })
  nameSnapshot!: string;
}

export class BuyerRefundEventDto {
  @ApiProperty({ type: 'string' })
  name!: string;
}

export class BuyerRefundCancellationDto {
  @ApiProperty({ type: () => BuyerRefundEventDto })
  event!: BuyerRefundEventDto;
}

export class BuyerRefundDetailDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: () => BuyerRefundOrderItemDto })
  orderItem!: BuyerRefundOrderItemDto;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ enum: EventBuyerRefundStatus, enumName: 'EventBuyerRefundStatus' })
  status!: EventBuyerRefundStatus;

  @ApiProperty({ type: 'string' })
  reason!: string;

  @ApiProperty({ type: () => BuyerRefundCancellationDto })
  cancellation!: BuyerRefundCancellationDto;

  @ApiProperty({ type: 'string', nullable: true })
  businessReason!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  beerryReason!: string | null;
}

export class BuyerRefundsResponseDto {
  @ApiProperty({ type: () => [BuyerRefundDetailDto] })
  requests!: BuyerRefundDetailDto[];
}

export class EventCancellationDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: EventCancellationStatus, enumName: 'EventCancellationStatus' })
  status!: EventCancellationStatus;

  @ApiProperty({ type: 'string' })
  reason!: string;

  @ApiProperty({ type: 'string' })
  eventId!: string;

  @ApiProperty({ enum: EventCancellationMode, enumName: 'EventCancellationMode' })
  mode!: EventCancellationMode;

  @ApiProperty({ type: 'string' })
  requestedByUserId!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  replacementEventId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewedByUserId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewReason!: string | null;
}

export class EventCancellationResponseDto {
  @ApiProperty({ type: () => EventCancellationDto, nullable: true })
  cancellation!: EventCancellationDto | null;

  @ApiProperty({ type: 'boolean' })
  canRequestRefund!: boolean;
}

export class CancellationRefundResponseDto {
  @ApiProperty({ type: () => EventCancellationDto })
  cancellation!: EventCancellationDto;
}

export class CancellationEventDto {
  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;
}

export class AdminEventCancellationDto {
  @ApiProperty({ type: () => CancellationEventDto })
  event!: CancellationEventDto;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: EventCancellationStatus, enumName: 'EventCancellationStatus' })
  status!: EventCancellationStatus;

  @ApiProperty({ type: 'string' })
  reason!: string;

  @ApiProperty({ type: 'string' })
  eventId!: string;

  @ApiProperty({ enum: EventCancellationMode, enumName: 'EventCancellationMode' })
  mode!: EventCancellationMode;

  @ApiProperty({ type: 'string' })
  requestedByUserId!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  replacementEventId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewedByUserId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewReason!: string | null;
}

export class AdminEventCancellationsResponseDto {
  @ApiProperty({ type: () => [AdminEventCancellationDto] })
  cancellations!: AdminEventCancellationDto[];
}
