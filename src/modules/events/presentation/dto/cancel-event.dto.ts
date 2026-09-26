import { ApiProperty } from '@nestjs/swagger';
import { EventCancellationMode } from '@prisma/client';
import { IsEnum, IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { OptionalField } from '../../../../shared/presentation/dto-fields';

export class CancelEventDto {
  @ApiProperty({ enum: EventCancellationMode, enumName: 'EventCancellationMode' })
  @IsEnum(EventCancellationMode)
  mode!: EventCancellationMode;

  @ApiProperty({ type: String, minLength: 5, maxLength: 1000 })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @OptionalField()
  @IsUUID()
  replacementEventId?: string;
}

export class ReviewEventCancellationDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}
