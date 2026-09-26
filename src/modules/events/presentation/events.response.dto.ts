import { ApiProperty } from '@nestjs/swagger';
import { ClubStatus, EventStatus, TicketTypeStatus } from '@prisma/client';

export class EventClubDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ enum: ClubStatus, enumName: 'ClubStatus' })
  status!: ClubStatus;
}

export class EventTicketTypeDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'number' })
  price!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;

  @ApiProperty({ type: 'integer' })
  quantityTotal!: number;

  @ApiProperty({ type: 'integer' })
  quantitySold!: number;

  @ApiProperty({ enum: TicketTypeStatus, enumName: 'TicketTypeStatus' })
  status!: TicketTypeStatus;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}

export class EventDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  imageObjectKey!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  imagePublicUrl!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  endsAt!: Date;

  @ApiProperty({ type: 'integer' })
  capacity!: number;

  @ApiProperty({ enum: EventStatus, enumName: 'EventStatus' })
  status!: EventStatus;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: () => EventClubDto })
  club!: EventClubDto;

  @ApiProperty({ type: () => [EventTicketTypeDto] })
  ticketTypes!: EventTicketTypeDto[];
}

export class EventResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => EventDto })
  event!: EventDto;
}

export class EventsResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => [EventDto] })
  events!: EventDto[];
}
