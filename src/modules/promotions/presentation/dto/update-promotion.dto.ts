import { PartialType } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePromotionDto } from './create-promotion.dto';
import { PromotionItemDto } from './promotion-item.dto';

export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PromotionItemDto)
  declare items?: PromotionItemDto[];
}
