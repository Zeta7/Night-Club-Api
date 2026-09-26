import { ApiProperty } from '@nestjs/swagger';
import { CapacityMovementType } from '@prisma/client';

export class CapacityResponseDto {
  @ApiProperty({ type: 'integer' })
  current!: number;

  @ApiProperty({ type: 'integer' })
  capacity!: number;

  @ApiProperty({ type: 'integer' })
  available!: number;

  @ApiProperty({ type: 'boolean' })
  full!: boolean;

  @ApiProperty({ type: 'boolean' })
  reentryAllowed!: boolean;

  @ApiProperty({ type: 'integer' })
  revision!: number;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  updatedAt!: Date | null;
}

export class CapacityMovementDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: CapacityMovementType, enumName: 'CapacityMovementType' })
  type!: CapacityMovementType;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', nullable: true })
  reason!: string | null;

  @ApiProperty({ type: 'string' })
  eventId!: string;

  @ApiProperty({ type: 'string' })
  actorUserId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  ticketId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  workerShiftId!: string | null;

  @ApiProperty({ type: 'integer' })
  delta!: number;

  @ApiProperty({ type: 'integer' })
  previousCount!: number;

  @ApiProperty({ type: 'integer' })
  newCount!: number;

  @ApiProperty({ type: 'string', nullable: true })
  idempotencyKey!: string | null;
}

export class CapacityHistoryResponseDto {
  @ApiProperty({ type: () => [CapacityMovementDto] })
  items!: CapacityMovementDto[];
}
