import { ApiProperty } from '@nestjs/swagger';
import {
  CLUB_SCHEDULE_DAYS,
  CLUB_SOCIAL_TYPES,
  ClubScheduleDay,
  ClubSocialType,
} from '../domain/club-profile';

export class ClubAddressResponseDto {
  @ApiProperty({ type: 'string' })
  direccion!: string;

  @ApiProperty({ type: 'string' })
  distrito!: string;

  @ApiProperty({ type: 'string' })
  provincia!: string;

  @ApiProperty({ type: 'string' })
  departamento!: string;

  @ApiProperty({ type: 'string' })
  pais!: string;

  @ApiProperty({ type: 'number', nullable: true })
  latitude!: number | null;

  @ApiProperty({ type: 'number', nullable: true })
  longitude!: number | null;

  @ApiProperty({ type: 'string' })
  location!: string;
}

export class ClubContactResponseDto {
  @ApiProperty({ type: 'string' })
  phone!: string;

  @ApiProperty({ type: 'string' })
  email!: string;
}

export class ClubSocialMediaResponseDto {
  @ApiProperty({ enum: CLUB_SOCIAL_TYPES, enumName: 'ClubSocialType' })
  type!: ClubSocialType;

  @ApiProperty({ type: 'string' })
  url!: string;
}

export class ClubScheduleResponseDto {
  @ApiProperty({ enum: CLUB_SCHEDULE_DAYS, enumName: 'ClubScheduleDay' })
  day!: ClubScheduleDay;

  @ApiProperty({ type: 'boolean' })
  isOpen!: boolean;

  @ApiProperty({ type: 'string' })
  openTime!: string;

  @ApiProperty({ type: 'string' })
  closeTime!: string;
}
