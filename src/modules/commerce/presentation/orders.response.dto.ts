import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CommerceItemType,
  MarketplaceFeeSource,
  OrderPaymentMethod,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentPurpose,
  Prisma,
  ProductDeliveryMode,
} from '@prisma/client';
import { RefundRequestDto } from './event-resolution.response.dto';

export class ClubOrdersSummaryDto {
  @ApiProperty({ type: 'integer' })
  salesCents!: number;

  @ApiProperty({ type: 'integer' })
  paidOrders!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;
}

export class OrderCustomerDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  phoneCountryCode!: string;

  @ApiProperty({ type: 'string' })
  phoneNumber!: string;

  @ApiProperty({ type: 'string' })
  fullName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  email!: string | null;
}

export class EventSnapshotDto {
  @ApiProperty({
    type: 'string',
    description:
      'Origin of the snapshot; historical rights do not recover the original event dates.',
  })
  source!: string;

  @ApiPropertyOptional({ type: 'string' })
  name?: string;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  startsAt?: string;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  endsAt?: string;
}

export class OrderItemDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'integer' })
  quantity!: number;

  @ApiProperty({ type: 'string' })
  orderId!: string;

  @ApiProperty({ type: 'integer' })
  totalCents!: number;

  @ApiProperty({ enum: CommerceItemType, enumName: 'CommerceItemType' })
  itemType!: CommerceItemType;

  @ApiProperty({ type: 'string' })
  itemId!: string;

  @ApiProperty({ enum: ProductDeliveryMode, enumName: 'ProductDeliveryMode' })
  productDeliveryMode!: ProductDeliveryMode;

  @ApiProperty({ type: 'string' })
  nameSnapshot!: string;

  @ApiProperty({ type: () => EventSnapshotDto, nullable: true })
  eventSnapshot!: EventSnapshotDto | null;

  @ApiProperty({ type: 'integer' })
  unitPriceCents!: number;
}

export class OrderPaymentAttemptDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: PaymentAttemptStatus, enumName: 'PaymentAttemptStatus' })
  status!: PaymentAttemptStatus;

  @ApiProperty({ type: 'string' })
  provider!: string;

  @ApiProperty({ allOf: [{ $ref: '#/components/schemas/JsonValue' }], nullable: true })
  providerData!: Prisma.JsonValue;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ enum: PaymentPurpose, enumName: 'PaymentPurpose' })
  purpose!: PaymentPurpose;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({ type: 'integer', nullable: true })
  marketplaceFeeBps!: number | null;

  @ApiProperty({ type: 'string', nullable: true })
  orderId!: string | null;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'integer', nullable: true })
  marketplaceFeeCents!: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  sellerExpectedNetCents!: number | null;

  @ApiProperty({ enum: MarketplaceFeeSource, enumName: 'MarketplaceFeeSource', nullable: true })
  feeSource!: MarketplaceFeeSource | null;

  @ApiProperty({ type: 'string', nullable: true })
  externalPaymentId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  failureCode!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  failureMessage!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  externalCheckoutId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  sellerExternalId!: string | null;

  @ApiProperty({ type: 'integer', nullable: true })
  grossAmountCents!: number | null;

  @ApiProperty({ type: 'integer', nullable: true })
  customerFundedSnapshotCents!: number | null;

  @ApiProperty({ type: 'integer' })
  refundedAmountCents!: number;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  approvedAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  failedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  walletTopUpId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  featuredCampaignId!: string | null;
}

export class ClubOrderDto {
  @ApiProperty({ type: () => OrderCustomerDto })
  user!: OrderCustomerDto;

  @ApiProperty({ type: () => [OrderItemDto] })
  items!: OrderItemDto[];

  @ApiProperty({ type: () => [RefundRequestDto] })
  refundRequests!: RefundRequestDto[];

  @ApiProperty({ type: () => [OrderPaymentAttemptDto] })
  paymentAttempts!: OrderPaymentAttemptDto[];

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  userId!: string;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status!: OrderStatus;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ enum: OrderPaymentMethod, enumName: 'OrderPaymentMethod' })
  paymentMethod!: OrderPaymentMethod;

  @ApiProperty({ type: 'boolean' })
  combineProducts!: boolean;

  @ApiProperty({ type: 'integer' })
  totalCents!: number;

  @ApiProperty({ type: 'integer' })
  promotionalCreditUsedCents!: number;

  @ApiProperty({ type: 'integer' })
  walletBalanceUsedCents!: number;

  @ApiProperty({ type: 'integer' })
  customerFundedCents!: number;

  @ApiProperty({ type: 'boolean' })
  simulatedPayment!: boolean;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  paidAt!: Date | null;
}

export class ClubOrdersResponseDto {
  @ApiProperty({ type: () => ClubOrdersSummaryDto })
  summary!: ClubOrdersSummaryDto;

  @ApiProperty({ type: () => [ClubOrderDto] })
  items!: ClubOrderDto[];
}

export class ClubOrderResponseDto {
  @ApiProperty({ type: () => ClubOrderDto })
  order!: ClubOrderDto;
}
