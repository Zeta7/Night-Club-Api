import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsString, IsUUID } from 'class-validator';
import { OptionalField } from '../../../shared/presentation/dto-fields';

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

  @ApiPropertyOptional({ enum: OrderStatus, enumName: 'OrderStatus' })
  @OptionalField()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @OptionalField()
  @IsString()
  search?: string;
}
