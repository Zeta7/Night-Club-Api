import { ApiProperty } from '@nestjs/swagger';
import { BusinessAccessRequestStatus, BusinessAccessRequestType } from '@prisma/client';
import { PaginationDto } from '../../../shared/presentation/response.dto';
import { ClubRecordDto } from '../../clubs/presentation/club-record.response.dto';

export class BusinessAccessUserDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  fullName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  email!: string | null;
}

export class BusinessAccessClubSummaryDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;
}

export class BusinessAccessRequestSummaryDto {
  @ApiProperty({ type: () => BusinessAccessUserDto })
  user!: BusinessAccessUserDto;

  @ApiProperty({ type: () => BusinessAccessClubSummaryDto, nullable: true })
  requestedClub!: BusinessAccessClubSummaryDto | null;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: BusinessAccessRequestType, enumName: 'BusinessAccessRequestType' })
  type!: BusinessAccessRequestType;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  userId!: string;

  @ApiProperty({ enum: BusinessAccessRequestStatus, enumName: 'BusinessAccessRequestStatus' })
  status!: BusinessAccessRequestStatus;

  @ApiProperty({ type: 'string' })
  location!: string;

  @ApiProperty({ type: 'string' })
  phone!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewedByUserId!: string | null;

  @ApiProperty({ type: 'string' })
  businessName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  taxId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  socialUrl!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  comment!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewComment!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  requestedClubId!: string | null;
}

export class AdminBusinessAccessRequestsResponseDto {
  @ApiProperty({ type: () => [BusinessAccessRequestSummaryDto] })
  items!: BusinessAccessRequestSummaryDto[];

  @ApiProperty({ type: () => PaginationDto })
  pagination!: PaginationDto;
}

export class BusinessAccessRequestDetailDto {
  @ApiProperty({ type: () => ClubRecordDto, nullable: true })
  requestedClub!: ClubRecordDto | null;

  @ApiProperty({ type: () => BusinessAccessUserDto })
  user!: BusinessAccessUserDto;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: BusinessAccessRequestType, enumName: 'BusinessAccessRequestType' })
  type!: BusinessAccessRequestType;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  userId!: string;

  @ApiProperty({ enum: BusinessAccessRequestStatus, enumName: 'BusinessAccessRequestStatus' })
  status!: BusinessAccessRequestStatus;

  @ApiProperty({ type: 'string' })
  location!: string;

  @ApiProperty({ type: 'string' })
  phone!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewedByUserId!: string | null;

  @ApiProperty({ type: 'string' })
  businessName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  taxId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  socialUrl!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  comment!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewComment!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  requestedClubId!: string | null;
}

export class BusinessAccessRequestDetailResponseDto {
  @ApiProperty({ type: () => BusinessAccessRequestDetailDto })
  request!: BusinessAccessRequestDetailDto;
}

export class BusinessAccessRequestRecordDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: BusinessAccessRequestType, enumName: 'BusinessAccessRequestType' })
  type!: BusinessAccessRequestType;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  userId!: string;

  @ApiProperty({ enum: BusinessAccessRequestStatus, enumName: 'BusinessAccessRequestStatus' })
  status!: BusinessAccessRequestStatus;

  @ApiProperty({ type: 'string' })
  location!: string;

  @ApiProperty({ type: 'string' })
  phone!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewedByUserId!: string | null;

  @ApiProperty({ type: 'string' })
  businessName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  taxId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  socialUrl!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  comment!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewComment!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  requestedClubId!: string | null;
}

export class ApprovedBusinessAccessResponseDto {
  @ApiProperty({ type: () => BusinessAccessRequestRecordDto })
  request!: BusinessAccessRequestRecordDto;

  @ApiProperty({ type: 'string', nullable: true })
  clubId!: string | null;

  @ApiProperty({ type: 'string' })
  message!: string;
}

export class BusinessAccessRequestRecordResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => BusinessAccessRequestRecordDto })
  request!: BusinessAccessRequestRecordDto;
}

export class MyBusinessAccessRequestDto {
  @ApiProperty({ type: () => BusinessAccessClubSummaryDto, nullable: true })
  requestedClub!: BusinessAccessClubSummaryDto | null;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: BusinessAccessRequestType, enumName: 'BusinessAccessRequestType' })
  type!: BusinessAccessRequestType;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  userId!: string;

  @ApiProperty({ enum: BusinessAccessRequestStatus, enumName: 'BusinessAccessRequestStatus' })
  status!: BusinessAccessRequestStatus;

  @ApiProperty({ type: 'string' })
  location!: string;

  @ApiProperty({ type: 'string' })
  phone!: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewedByUserId!: string | null;

  @ApiProperty({ type: 'string' })
  businessName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  taxId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  socialUrl!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  comment!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  reviewComment!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  requestedClubId!: string | null;
}

export class MyBusinessAccessRequestsResponseDto {
  @ApiProperty({ type: () => [MyBusinessAccessRequestDto] })
  items!: MyBusinessAccessRequestDto[];
}

export class MyBusinessAccessRequestResponseDto {
  @ApiProperty({ type: () => MyBusinessAccessRequestDto })
  request!: MyBusinessAccessRequestDto;
}
