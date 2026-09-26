import { ApiProperty } from '@nestjs/swagger';
import { CommerceItemType, EventRefundJobStatus, RefundRequestStatus } from '@prisma/client';

export class RefundJobResourceCountsDto {
  @ApiProperty({ type: 'integer' })
  tickets!: number;

  @ApiProperty({ type: 'integer' })
  consumableRights!: number;
}

export class RefundJobOrderItemDto {
  @ApiProperty({ type: () => RefundJobResourceCountsDto })
  _count!: RefundJobResourceCountsDto;

  @ApiProperty({ type: 'integer' })
  quantity!: number;

  @ApiProperty({ type: 'integer' })
  totalCents!: number;

  @ApiProperty({ type: 'string' })
  nameSnapshot!: string;
}

export class EventRefundJobDto {
  @ApiProperty({ type: () => RefundJobOrderItemDto })
  orderItem!: RefundJobOrderItemDto;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: EventRefundJobStatus, enumName: 'EventRefundJobStatus' })
  status!: EventRefundJobStatus;

  @ApiProperty({ type: 'integer' })
  attempts!: number;

  @ApiProperty({ type: 'string', nullable: true })
  lastError!: string | null;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'string' })
  orderItemId!: string;

  @ApiProperty({ type: 'string' })
  cancellationId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  refundRequestId!: string | null;

  @ApiProperty({ type: 'string' })
  authorizedBy!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  nextRunAt!: Date;

  @ApiProperty({ type: 'string', nullable: true })
  leaseToken!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  manualReviewNote!: string | null;
}

export class EventRefundJobsResponseDto {
  @ApiProperty({ type: () => [EventRefundJobDto] })
  jobs!: EventRefundJobDto[];
  @ApiProperty({ type: () => [RefundRequestDto] })
  unallocatedRefunds!: RefundRequestDto[];
}

export class ReviewRefundJobResponseDto {
  @ApiProperty({ type: 'boolean' })
  updated!: boolean;
}

export class RefundRequestDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: RefundRequestStatus, enumName: 'RefundRequestStatus' })
  status!: RefundRequestStatus;

  @ApiProperty({ type: 'string' })
  reason!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  orderId!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: 'string' })
  requestedByUserId!: string;

  @ApiProperty({ type: 'integer', nullable: true })
  requestedAmountCents!: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  approvedAmountCents!: number | null;

  @ApiProperty({ type: 'integer' })
  processedAmountCents!: number;

  @ApiProperty({ type: 'integer' })
  marketplaceFeeRefundedCents!: number;

  @ApiProperty({ type: 'string', nullable: true })
  externalRefundId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  resolutionNote!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  requestedAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  reviewedAt!: Date | null;
}

export class UnallocatedRefundResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => RefundRequestDto })
  refundRequest!: RefundRequestDto;

  @ApiProperty({ type: 'boolean' })
  confirmed!: boolean;
}

export class ReplacementSourceTotalsDto {
  @ApiProperty({ type: 'integer', nullable: true })
  quantity!: number | null;
}

export class ReplacementSourceDto {
  @ApiProperty({ enum: CommerceItemType, enumName: 'CommerceItemType' })
  itemType!: CommerceItemType;

  @ApiProperty({ type: 'string' })
  itemId!: string;

  @ApiProperty({ type: 'string' })
  nameSnapshot!: string;

  @ApiProperty({ type: () => ReplacementSourceTotalsDto })
  _sum!: ReplacementSourceTotalsDto;
}

export class ReplacementResourceDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;
}

export class EventReplacementMappingDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ enum: CommerceItemType, enumName: 'CommerceItemType' })
  itemType!: CommerceItemType;

  @ApiProperty({ type: 'string' })
  cancellationId!: string;

  @ApiProperty({ type: 'string' })
  sourceItemId!: string;

  @ApiProperty({ type: 'string' })
  targetItemId!: string;

  @ApiProperty({ type: 'string' })
  targetName!: string;

  @ApiProperty({ type: 'integer' })
  reservedQuantity!: number;
}

export class ReplacementOptionsResponseDto {
  @ApiProperty({ type: () => [ReplacementSourceDto] })
  source!: ReplacementSourceDto[];

  @ApiProperty({ type: () => [ReplacementResourceDto] })
  tickets!: ReplacementResourceDto[];

  @ApiProperty({ type: () => [ReplacementResourceDto] })
  promotions!: ReplacementResourceDto[];

  @ApiProperty({ type: () => [EventReplacementMappingDto] })
  mappings!: EventReplacementMappingDto[];
}

export class ReplacementMappingResponseDto {
  @ApiProperty({ type: () => EventReplacementMappingDto })
  mapping!: EventReplacementMappingDto;
}

export class AcceptReplacementResponseDto {
  @ApiProperty({ type: 'boolean' })
  accepted!: boolean;
}
