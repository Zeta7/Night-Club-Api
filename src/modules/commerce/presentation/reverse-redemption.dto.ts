import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReverseRedemptionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason!: string;
}
