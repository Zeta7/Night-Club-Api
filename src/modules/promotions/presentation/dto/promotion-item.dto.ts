import { PromotionDiscountType, PromotionItemType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateIf } from 'class-validator';

export class PromotionItemDto {
  @ApiProperty({ enum: PromotionItemType })
  @IsEnum(PromotionItemType)
  itemType!: PromotionItemType;

  @ApiProperty({ required: false })
  @ValidateIf((object: PromotionItemDto) => object.itemType === PromotionItemType.PRODUCT)
  @IsUUID()
  productId?: string;

  @ApiProperty({ required: false })
  @ValidateIf((object: PromotionItemDto) => object.itemType === PromotionItemType.TICKET)
  @IsUUID()
  ticketTypeId?: string;

  @ApiProperty()
  @Type(() => Number)
  @Min(1)
  quantity!: number;

  @ApiProperty({ enum: PromotionDiscountType, required: false, default: PromotionDiscountType.NONE })
  @IsOptional()
  @IsEnum(PromotionDiscountType)
  discountType?: PromotionDiscountType;

  @ApiProperty({ required: false, description: 'Porcentaje entero o monto fijo segun discountType.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;
}
