import { OptionalField } from '../../../shared/presentation/dto-fields';
import { OrderStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsString, IsUUID } from 'class-validator';

export class ClubOrdersQueryDto {
  @OptionalField({ format: 'date-time' })
  @IsDateString()
  from?: string;

  @OptionalField({ format: 'date-time' })
  @IsDateString()
  to?: string;

  @OptionalField()
  @IsUUID()
  eventId?: string;

  @OptionalField()
  @IsUUID()
  productId?: string;

  @OptionalField()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @OptionalField()
  @IsString()
  search?: string;
}
