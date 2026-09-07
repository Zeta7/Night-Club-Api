import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class RequestRefundDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;
}
