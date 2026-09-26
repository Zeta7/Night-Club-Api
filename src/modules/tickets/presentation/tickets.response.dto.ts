import { ApiProperty } from '@nestjs/swagger';
import { TicketTypeStatus } from '@prisma/client';

export class TicketTypeClubDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;
}

export class TicketTypeEventDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  startsAt!: Date;
}

export class TicketTypeDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string' })
  scope!: string;

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

  @ApiProperty({ type: 'integer' })
  quantityAvailable!: number;

  @ApiProperty({ type: 'integer', nullable: true })
  perUserLimit!: number | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  saleStartAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  saleEndAt!: Date | null;

  @ApiProperty({ enum: TicketTypeStatus, enumName: 'TicketTypeStatus' })
  status!: TicketTypeStatus;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: () => TicketTypeClubDto })
  club!: TicketTypeClubDto;

  @ApiProperty({ type: () => TicketTypeEventDto, nullable: true })
  event!: TicketTypeEventDto | null;
}

export class TicketTypeResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => TicketTypeDto })
  ticketType!: TicketTypeDto;
}

export class TicketTypesResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => [TicketTypeDto] })
  ticketTypes!: TicketTypeDto[];
}
