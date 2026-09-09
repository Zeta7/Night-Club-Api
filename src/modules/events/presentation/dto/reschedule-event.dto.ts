import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class EventReasonDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class RescheduleEventDto extends EventReasonDto {
  @IsDateString()
  startsAt!: string;
  @IsDateString()
  endsAt!: string;
}
