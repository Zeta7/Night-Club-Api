import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ClubOrdersQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsIn(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
