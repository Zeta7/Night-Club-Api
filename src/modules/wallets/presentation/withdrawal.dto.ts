import { WithdrawalStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsInteger, OptionalField } from '../../../shared/presentation/dto-fields';

export class UpsertFinancialProfileDto {
  @IsString() @MinLength(2) @MaxLength(150) legalName!: string;
  @IsString() @MinLength(2) @MaxLength(30) taxDocumentType!: string;
  @IsString() @MinLength(6) @MaxLength(30) taxDocumentNumber!: string;
  @IsString() @MinLength(2) @MaxLength(100) bankName!: string;
  @IsString() @MinLength(2) @MaxLength(40) bankAccountType!: string;
  @IsString() @MinLength(8) @MaxLength(60) bankAccountNumber!: string;
  @IsString() @MinLength(2) @MaxLength(150) bankAccountHolder!: string;
}

export class CreateWithdrawalDto {
  @IsInteger() @Min(1) amountCents!: number;
  @OptionalField() @IsString() @MaxLength(300) note?: string;
}

export class ReviewWithdrawalDto {
  @IsIn(['APPROVE', 'REJECT']) action!: 'APPROVE' | 'REJECT';
  @OptionalField() @IsString() @MaxLength(300) reason?: string;
}

export class PayWithdrawalDto {
  @IsString() @MinLength(3) @MaxLength(120) paymentReference!: string;
  @OptionalField() @IsString() @MaxLength(1000) proofUrl?: string;
}

export class FailWithdrawalDto {
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}

export class ListWithdrawalsDto {
  @OptionalField({ enum: WithdrawalStatus, enumName: 'WithdrawalStatus' })
  @IsEnum(WithdrawalStatus)
  status?: WithdrawalStatus;
}

export class DailyReconciliationQueryDto {
  @OptionalField({ format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date?: string;
}
