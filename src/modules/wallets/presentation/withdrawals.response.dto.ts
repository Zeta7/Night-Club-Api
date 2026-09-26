import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus, WithdrawalStatus } from '@prisma/client';
import { ClubRecordDto } from '../../clubs/presentation/club-record.response.dto';

export class FinancialProfileResponseDto {
  @ApiProperty({ type: 'string' })
  maskedBankAccount!: string;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  legalName!: string;

  @ApiProperty({ type: 'string' })
  taxDocumentType!: string;

  @ApiProperty({ type: 'string' })
  taxDocumentNumber!: string;

  @ApiProperty({ type: 'string' })
  bankName!: string;

  @ApiProperty({ type: 'string' })
  bankAccountType!: string;

  @ApiProperty({ type: 'string' })
  bankAccountLast4!: string;

  @ApiProperty({ type: 'string' })
  bankAccountHolder!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  verifiedAt!: Date | null;
}

export class WithdrawalResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: WithdrawalStatus, enumName: 'WithdrawalStatus' })
  status!: WithdrawalStatus;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  paidAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  approvedAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  failedAt!: Date | null;

  @ApiProperty({ type: 'string' })
  requestedByUserId!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  requestedAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewedByUserId!: string | null;

  @ApiProperty({ type: 'string' })
  bankAccountLast4!: string;

  @ApiProperty({ type: 'string', nullable: true })
  requestNote!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  rejectionReason!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  paymentReference!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  proofUrl!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  processingAt!: Date | null;
}

export class ClubWithdrawalsResponseDto {
  @ApiProperty({ type: () => [WithdrawalResponseDto] })
  items!: WithdrawalResponseDto[];
}

export class WithdrawalRequesterDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status!: UserStatus;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  @ApiProperty({ type: 'string' })
  phoneCountryCode!: string;

  @ApiProperty({ type: 'string' })
  phoneNumber!: string;

  @ApiProperty({ type: 'string' })
  fullName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  email!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  referralCode!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  phoneVerifiedAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  emailVerifiedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  profileImageUrl!: string | null;
}

export class PlatformWithdrawalDto {
  @ApiProperty({ type: () => ClubRecordDto })
  club!: ClubRecordDto;

  @ApiProperty({ type: () => WithdrawalRequesterDto })
  requestedBy!: WithdrawalRequesterDto;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: WithdrawalStatus, enumName: 'WithdrawalStatus' })
  status!: WithdrawalStatus;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  paidAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  approvedAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  failedAt!: Date | null;

  @ApiProperty({ type: 'string' })
  requestedByUserId!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  requestedAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewedByUserId!: string | null;

  @ApiProperty({ type: 'string' })
  bankAccountLast4!: string;

  @ApiProperty({ type: 'string', nullable: true })
  requestNote!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  rejectionReason!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  paymentReference!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  proofUrl!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  processingAt!: Date | null;
}

export class PlatformWithdrawalsResponseDto {
  @ApiProperty({ type: () => [PlatformWithdrawalDto] })
  items!: PlatformWithdrawalDto[];
}
