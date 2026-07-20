import { PromotionPricingMode } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PromotionItemDto } from './promotion-item.dto';

export class CreatePromotionDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  imageUploadId?: string;

  @ApiProperty({ enum: PromotionPricingMode, required: false, default: PromotionPricingMode.CALCULATED })
  @IsOptional()
  @IsEnum(PromotionPricingMode)
  pricingMode?: PromotionPricingMode;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiProperty({ type: [PromotionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PromotionItemDto)
  items!: PromotionItemDto[];

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  removeImage?: boolean;
}
