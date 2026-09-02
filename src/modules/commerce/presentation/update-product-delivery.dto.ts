import { ProductDeliveryMode } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsUUID, ValidateNested } from 'class-validator';

export class ProductDeliveryItemDto {
  @IsUUID()
  cartItemId!: string;

  @IsEnum(ProductDeliveryMode)
  mode!: ProductDeliveryMode;
}

export class UpdateProductDeliveryDto {
  @IsOptional()
  @IsBoolean()
  combineProducts?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDeliveryItemDto)
  items?: ProductDeliveryItemDto[];
}
