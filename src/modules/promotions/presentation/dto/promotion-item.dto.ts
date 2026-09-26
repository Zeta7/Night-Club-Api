import { ApiProperty } from '@nestjs/swagger';
import { PromotionDiscountType, PromotionItemType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsUUID, Min, ValidateIf } from 'class-validator';
import { IsInteger, OptionalField } from '../../../../shared/presentation/dto-fields';

export class PromotionItemDto {
  @ApiProperty({ enum: PromotionItemType, enumName: 'PromotionItemType' })
  @IsEnum(PromotionItemType)
  itemType!: PromotionItemType;

  @ApiProperty({ required: false })
  @ValidateIf(
    (object: PromotionItemDto) =>
      object.productId !== undefined || object.itemType === PromotionItemType.PRODUCT,
  )
  @IsUUID()
  productId?: string;

  @ApiProperty({ required: false })
  @ValidateIf(
    (object: PromotionItemDto) =>
      object.ticketTypeId !== undefined || object.itemType === PromotionItemType.TICKET,
  )
  @IsUUID()
  ticketTypeId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInteger()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    enum: PromotionDiscountType,
    enumName: 'PromotionDiscountType',
    required: false,
    default: PromotionDiscountType.NONE,
  })
  @OptionalField()
  @IsEnum(PromotionDiscountType)
  discountType?: PromotionDiscountType;

  @ApiProperty({
    required: false,
    description: 'Porcentaje entero o monto fijo segun discountType.',
  })
  @OptionalField()
  @IsNumber()
  @Min(0)
  discountValue?: number;
}
