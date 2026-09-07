import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ProcessRefundDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  approvedAmountCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionNote?: string;
}
