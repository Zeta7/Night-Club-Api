import { ApiProperty } from '@nestjs/swagger';
import { ClubStatus, EventStatus } from '@prisma/client';
import { BusinessType } from '../../clubs/domain/business-type';
import { EventTicketTypeDto } from './events.response.dto';

export class EventsDashboardSummaryDto {
  @ApiProperty({ type: 'integer' })
  activeEvents!: number;

  @ApiProperty({ type: 'integer' })
  publishedEvents!: number;

  @ApiProperty({ type: 'integer' })
  ticketsSold!: number;

  @ApiProperty({ type: 'number' })
  salesAmount!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;
}

export class EventsDashboardAlertDto {
  @ApiProperty({ type: 'string' })
  type!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string' })
  text!: string;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;
}

export class EventsDashboardEventDto {
  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  endsAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'integer' })
  capacity!: number;

  @ApiProperty({ type: 'integer' })
  sold!: number;

  @ApiProperty({ type: 'number' })
  salesAmount!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({
    enum: Object.values(EventStatus).map((value) => value.toLowerCase()),
    enumName: 'EventDisplayStatus',
  })
  status!: Lowercase<EventStatus>;

  @ApiProperty({ enum: EventStatus, enumName: 'EventStatus' })
  rawStatus!: EventStatus;

  @ApiProperty({ type: 'number' })
  progress!: number;

  @ApiProperty({ type: () => [EventTicketTypeDto] })
  ticketTypes!: EventTicketTypeDto[];
}

export class EventsDashboardTopEventDto {
  @ApiProperty({ type: 'integer' })
  rank!: number;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'number' })
  amount!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;
}

export class EventsDashboardClubDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ enum: BusinessType, enumName: 'BusinessType' })
  type!: BusinessType;

  @ApiProperty({ enum: ClubStatus, enumName: 'ClubStatus' })
  status!: ClubStatus;
}

export class EventsDashboardResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: 'boolean' })
  hasClub!: boolean;

  @ApiProperty({ type: () => EventsDashboardSummaryDto })
  summary!: EventsDashboardSummaryDto;

  @ApiProperty({ type: () => [EventsDashboardAlertDto] })
  alerts!: EventsDashboardAlertDto[];

  @ApiProperty({ type: () => [EventsDashboardEventDto] })
  events!: EventsDashboardEventDto[];

  @ApiProperty({ type: () => [EventsDashboardTopEventDto] })
  topEvents!: EventsDashboardTopEventDto[];

  @ApiProperty({ type: () => EventsDashboardClubDto, nullable: true })
  club!: EventsDashboardClubDto | null;
}
