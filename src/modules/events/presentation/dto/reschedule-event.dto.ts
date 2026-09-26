import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class EventReasonDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class RescheduleEventDto extends EventReasonDto {
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  endsAt!: string;
}
