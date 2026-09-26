import { ApiProperty } from '@nestjs/swagger';
import {
  FinancialAccountOwnerType,
  FinancialBalanceBucket,
  LedgerEntryDirection,
  LedgerTransactionType,
  Prisma,
} from '@prisma/client';

export class ClubLedgerBalanceDto {
  @ApiProperty({ type: 'integer' })
  pendingCents!: number;

  @ApiProperty({ type: 'integer' })
  availableCents!: number;

  @ApiProperty({ type: 'integer' })
  heldCents!: number;

  @ApiProperty({ type: 'integer' })
  withdrawnCents!: number;
}

export class ClubLedgerMovementTransactionDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: LedgerTransactionType, enumName: 'LedgerTransactionType' })
  type!: LedgerTransactionType;

  @ApiProperty({ type: 'string' })
  description!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ allOf: [{ $ref: '#/components/schemas/JsonValue' }], nullable: true })
  metadata!: Prisma.JsonValue;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string' })
  reference!: string;

  @ApiProperty({ type: 'string', nullable: true })
  orderId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  paymentAttemptId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  providerEventId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  reversalOfId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  withdrawalRequestId!: string | null;

  @ApiProperty({ type: 'integer' })
  debitTotalCents!: number;

  @ApiProperty({ type: 'integer' })
  creditTotalCents!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  postedAt!: Date;
}

export class ClubLedgerMovementDto {
  @ApiProperty({ type: () => ClubLedgerMovementTransactionDto })
  transaction!: ClubLedgerMovementTransactionDto;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  description!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ enum: LedgerEntryDirection, enumName: 'LedgerEntryDirection' })
  direction!: LedgerEntryDirection;

  @ApiProperty({ enum: FinancialBalanceBucket, enumName: 'FinancialBalanceBucket' })
  bucket!: FinancialBalanceBucket;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'string' })
  accountId!: string;

  @ApiProperty({ type: 'string' })
  transactionId!: string;
}

export class ClubLedgerResponseDto {
  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: () => ClubLedgerBalanceDto })
  balances!: ClubLedgerBalanceDto;

  @ApiProperty({ type: () => [ClubLedgerMovementDto] })
  movements!: ClubLedgerMovementDto[];
}

export class OrderReconciliationTransactionEntryAccountDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string', nullable: true })
  userId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  provider!: string | null;

  @ApiProperty({ type: 'string' })
  code!: string;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string', nullable: true })
  clubId!: string | null;

  @ApiProperty({ enum: FinancialAccountOwnerType, enumName: 'FinancialAccountOwnerType' })
  ownerType!: FinancialAccountOwnerType;

  @ApiProperty({ type: 'integer' })
  pendingCents!: number;

  @ApiProperty({ type: 'integer' })
  availableCents!: number;

  @ApiProperty({ type: 'integer' })
  heldCents!: number;

  @ApiProperty({ type: 'integer' })
  withdrawnCents!: number;
}

export class OrderReconciliationTransactionEntryDto {
  @ApiProperty({ type: () => OrderReconciliationTransactionEntryAccountDto })
  account!: OrderReconciliationTransactionEntryAccountDto;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  description!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ enum: LedgerEntryDirection, enumName: 'LedgerEntryDirection' })
  direction!: LedgerEntryDirection;

  @ApiProperty({ enum: FinancialBalanceBucket, enumName: 'FinancialBalanceBucket' })
  bucket!: FinancialBalanceBucket;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'string' })
  accountId!: string;

  @ApiProperty({ type: 'string' })
  transactionId!: string;
}

export class OrderReconciliationTransactionDto {
  @ApiProperty({ type: () => [OrderReconciliationTransactionEntryDto] })
  entries!: OrderReconciliationTransactionEntryDto[];

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: LedgerTransactionType, enumName: 'LedgerTransactionType' })
  type!: LedgerTransactionType;

  @ApiProperty({ type: 'string' })
  description!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ allOf: [{ $ref: '#/components/schemas/JsonValue' }], nullable: true })
  metadata!: Prisma.JsonValue;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string' })
  reference!: string;

  @ApiProperty({ type: 'string', nullable: true })
  orderId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  paymentAttemptId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  providerEventId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  reversalOfId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  withdrawalRequestId!: string | null;

  @ApiProperty({ type: 'integer' })
  debitTotalCents!: number;

  @ApiProperty({ type: 'integer' })
  creditTotalCents!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  postedAt!: Date;
}

export class OrderReconciliationResponseDto {
  @ApiProperty({ type: 'string' })
  orderId!: string;

  @ApiProperty({ type: 'boolean' })
  balanced!: boolean;

  @ApiProperty({ type: 'integer' })
  debitTotalCents!: number;

  @ApiProperty({ type: 'integer' })
  creditTotalCents!: number;

  @ApiProperty({ type: 'integer' })
  differenceCents!: number;

  @ApiProperty({ type: () => [OrderReconciliationTransactionDto] })
  transactions!: OrderReconciliationTransactionDto[];
}

export class LedgerDifferencesResponseDto {
  @ApiProperty({ type: 'string' })
  date!: string;

  @ApiProperty({ type: 'boolean' })
  balanced!: boolean;

  @ApiProperty({ type: 'integer' })
  debitTotalCents!: number;

  @ApiProperty({ type: 'integer' })
  creditTotalCents!: number;

  @ApiProperty({ type: 'integer' })
  differenceCents!: number;

  @ApiProperty({ type: 'integer' })
  transactionCount!: number;
}
