import { OptionalField } from '../../../shared/presentation/dto-fields';
import { IsDateString, IsIn, IsString, IsUUID } from 'class-validator';

export class ClubOrdersQueryDto {
  @OptionalField()
  @IsDateString()
  from?: string;

  @OptionalField()
  @IsDateString()
  to?: string;

  @OptionalField()
  @IsUUID()
  eventId?: string;

  @OptionalField()
  @IsUUID()
  productId?: string;

  @OptionalField()
  @IsIn([
    'PENDING',
    'PAID',
    'FAILED',
    'EXPIRED',
    'CANCELLED',
    'REFUND_PENDING',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
  ])
  status?: string;

  @OptionalField()
  @IsString()
  search?: string;
}
