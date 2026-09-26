import { ApiProperty } from '@nestjs/swagger';
import { ClubStatus } from '@prisma/client';
import {
  ClubAddressResponseDto,
  ClubContactResponseDto,
  ClubScheduleResponseDto,
  ClubSocialMediaResponseDto,
} from './club-profile.response.dto';

export class ClubAdminDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  fullName!: string;

  @ApiProperty({ type: 'string' })
  phoneCountryCode!: string;

  @ApiProperty({ type: 'string' })
  phoneNumber!: string;

  @ApiProperty({ type: 'string', nullable: true })
  email!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  profileImage!: string | null;
}

export class ClubDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string' })
  type!: string;

  @ApiProperty({ type: 'string', nullable: true })
  coverImage!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  coverImageObjectKey!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  profileImage!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  profileImageObjectKey!: string | null;

  @ApiProperty({ type: () => ClubAddressResponseDto })
  address!: ClubAddressResponseDto;

  @ApiProperty({ type: () => ClubContactResponseDto })
  contact!: ClubContactResponseDto;

  @ApiProperty({ type: () => [ClubSocialMediaResponseDto] })
  socialMedia!: ClubSocialMediaResponseDto[];

  @ApiProperty({ type: () => [ClubScheduleResponseDto] })
  schedule!: ClubScheduleResponseDto[];

  @ApiProperty({ enum: ClubStatus, enumName: 'ClubStatus' })
  status!: ClubStatus;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: () => [ClubAdminDto] })
  admins!: ClubAdminDto[];
}

export class ClubResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => ClubDto })
  club!: ClubDto;
}

export class ClubsResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => [ClubDto] })
  clubs!: ClubDto[];
}

export class ClubOperationalProfileDto {
  @ApiProperty({ type: 'array', items: { type: 'string' } })
  approvalDocumentUploadIds!: string[];

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  refundPolicy!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  responsibleName!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  responsibleEmail!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  responsiblePhone!: string | null;
}

export class ClubOperationalProfileResponseDto {
  @ApiProperty({ type: () => ClubOperationalProfileDto, nullable: true })
  profile!: ClubOperationalProfileDto | null;
}

export class UpdateClubOperationalProfileResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => ClubOperationalProfileDto })
  profile!: ClubOperationalProfileDto;
}
