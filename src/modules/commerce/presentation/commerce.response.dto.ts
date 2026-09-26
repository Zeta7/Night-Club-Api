import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  CommerceItemType,
  OrderPaymentMethod,
  OrderStatus,
  PaymentAttemptStatus,
  ProductDeliveryMode,
  ProductStatus,
  WalletTopUpStatus,
} from '@prisma/client';
import { RefundRequestDto } from './event-resolution.response.dto';

export class CheckoutResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: 'string' })
  orderId!: string;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  orderStatus!: OrderStatus;

  @ApiProperty({ type: 'string', nullable: true })
  paymentAttemptId!: string | null;

  @ApiProperty({ enum: PaymentAttemptStatus, enumName: 'PaymentAttemptStatus', nullable: true })
  paymentStatus!: PaymentAttemptStatus | null;

  @ApiProperty({ type: 'string', nullable: true })
  paymentProvider!: string | null;

  @ApiProperty({ enum: OrderPaymentMethod, enumName: 'OrderPaymentMethod' })
  paymentMethod!: OrderPaymentMethod;

  @ApiProperty({ type: 'string', nullable: true })
  checkoutUrl!: string | null;

  @ApiProperty({ type: 'number' })
  total!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;
}

export class PaymentOptionsResponseDto {
  @ApiProperty({ type: 'boolean' })
  acceptsWallet!: boolean;
}

export class CartItemDto {
  @ApiProperty({ type: 'string' })
  cartItemId!: string;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: CommerceItemType, enumName: 'CommerceItemType' })
  type!: CommerceItemType;

  @ApiProperty({ type: 'integer' })
  quantity!: number;

  @ApiProperty({ enum: ProductDeliveryMode, enumName: 'ProductDeliveryMode' })
  productDeliveryMode!: ProductDeliveryMode;

  @ApiProperty({ type: 'boolean' })
  combineProducts!: boolean;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  clubId!: string | null;

  @ApiProperty({ type: 'string' })
  clubName!: string;

  @ApiProperty({ type: 'integer' })
  priceCents!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'boolean' })
  available!: boolean;

  @ApiProperty({ type: 'string', nullable: true })
  availabilityMessage!: string | null;

  @ApiProperty({ type: 'integer' })
  lineTotalCents!: number;
}

export class CartResponseDto {
  @ApiProperty({ type: 'string', nullable: true })
  id!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  clubId!: string | null;

  @ApiProperty({ type: 'boolean' })
  combineProducts!: boolean;

  @ApiProperty({ type: () => [CartItemDto] })
  items!: CartItemDto[];

  @ApiProperty({ type: 'integer' })
  totalCents!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'boolean' })
  hasUnavailableItems!: boolean;
}

export class ReservationCountsDto {
  @ApiProperty({ type: 'integer' })
  reservations!: number;

  @ApiProperty({ type: 'integer' })
  units!: number;
}

@ApiExtraModels(ReservationCountsDto)
export class ReservationMetricsResponseDto {
  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(ReservationCountsDto) },
  })
  statuses!: Record<string, ReservationCountsDto>;
}

export class WalletTopUpResponseDto {
  @ApiProperty({ type: 'string' })
  topUpId!: string;

  @ApiProperty({ enum: WalletTopUpStatus, enumName: 'WalletTopUpStatus' })
  status!: WalletTopUpStatus;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string', nullable: true })
  paymentAttemptId!: string | null;

  @ApiProperty({ enum: PaymentAttemptStatus, enumName: 'PaymentAttemptStatus', nullable: true })
  paymentStatus!: PaymentAttemptStatus | null;

  @ApiProperty({ type: 'string', nullable: true })
  paymentProvider!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  checkoutUrl!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  approvedAt!: Date | null;
}

export class WalletTopUpsResponseDto {
  @ApiProperty({ type: () => [WalletTopUpResponseDto] })
  items!: WalletTopUpResponseDto[];
}

export class RequestedRefundResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => RefundRequestDto })
  refundRequest!: RefundRequestDto;
}

export class OperationsLowStockDto {
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

  @ApiProperty({ enum: ProductStatus, enumName: 'ProductStatus' })
  status!: ProductStatus;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'integer' })
  priceCents!: number;

  @ApiProperty({ type: 'integer' })
  stockQuantity!: number;
}

export class SimulatedPaymentResponseDto {
  @ApiProperty({ type: () => CheckoutResponseDto, nullable: true })
  order!: CheckoutResponseDto | null;
  @ApiProperty({ type: () => WalletTopUpResponseDto, nullable: true })
  topUp!: WalletTopUpResponseDto | null;
}

export class PaymentWebhookResponseDto {
  @ApiProperty({ type: 'boolean' })
  received!: boolean;
}
