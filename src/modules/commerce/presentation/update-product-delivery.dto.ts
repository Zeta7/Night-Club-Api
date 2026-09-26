import { OptionalField } from '../../../shared/presentation/dto-fields';
import { ProductDeliveryMode } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsUUID, ValidateNested } from 'class-validator';

export class ProductDeliveryItemDto {
  @IsUUID()
  cartItemId!: string;

  @IsEnum(ProductDeliveryMode)
  mode!: ProductDeliveryMode;
}

export class UpdateProductDeliveryDto {
  @OptionalField()
  @IsBoolean()
  combineProducts?: boolean;

  @OptionalField()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDeliveryItemDto)
  items?: ProductDeliveryItemDto[];
}
