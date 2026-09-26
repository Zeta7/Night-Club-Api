import { ApiProperty } from '@nestjs/swagger';
import { ClubStatus } from '@prisma/client';
import { BusinessType } from '../domain/business-type';
import {
  ClubAddressResponseDto,
  ClubContactResponseDto,
  ClubScheduleResponseDto,
  ClubSocialMediaResponseDto,
} from './club-profile.response.dto';

export class ClubRecordDto {
  @ApiProperty({ type: () => ClubAddressResponseDto })
  addressJson!: ClubAddressResponseDto;

  @ApiProperty({ type: () => ClubContactResponseDto })
  contactJson!: ClubContactResponseDto;

  @ApiProperty({ type: () => [ClubSocialMediaResponseDto] })
  socialMediaJson!: ClubSocialMediaResponseDto[];

  @ApiProperty({ type: () => [ClubScheduleResponseDto] })
  scheduleJson!: ClubScheduleResponseDto[];

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: BusinessType, enumName: 'BusinessType' })
  type!: BusinessType;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ enum: ClubStatus, enumName: 'ClubStatus' })
  status!: ClubStatus;

  @ApiProperty({ type: 'string', nullable: true })
  profileImageUrl!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  coverImageUrl!: string | null;

  @ApiProperty({ type: 'integer', nullable: true })
  marketplaceFeeBps!: number | null;

  @ApiProperty({ type: 'boolean' })
  acceptsWalletPayments!: boolean;
}
