import { OptionalField } from '../../../../shared/presentation/dto-fields';
import { PromotionPricingMode, PromotionStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
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
  @OptionalField({ nullable: true, type: String })
  @IsString()
  description?: string | null;

  @ApiProperty({ required: false })
  @OptionalField({ nullable: true, type: String })
  @IsUUID()
  eventId?: string | null;

  @ApiProperty({ required: false })
  @OptionalField()
  @IsUUID()
  imageUploadId?: string;

  @ApiProperty({
    enum: PromotionPricingMode,
    required: false,
    default: PromotionPricingMode.CALCULATED,
  })
  @OptionalField()
  @IsEnum(PromotionPricingMode)
  pricingMode?: PromotionPricingMode;

  @ApiProperty({ required: false })
  @OptionalField()
  @IsNumber()
  @Min(0)
  finalPrice?: number;

  @ApiProperty({ required: false })
  @OptionalField()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @OptionalField({ nullable: true, type: String, format: 'date-time' })
  @IsDateString()
  startsAt?: string | null;

  @ApiProperty({ required: false })
  @OptionalField({ nullable: true, type: String, format: 'date-time' })
  @IsDateString()
  endsAt?: string | null;

  @ApiProperty({ type: [PromotionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PromotionItemDto)
  items!: PromotionItemDto[];

  @ApiProperty({ required: false, default: false })
  @OptionalField()
  @IsBoolean()
  removeImage?: boolean;
}

export class ListPromotionsQueryDto {
  @OptionalField({ format: 'uuid' })
  @IsUUID()
  eventId?: string;

  @OptionalField({ enum: PromotionStatus })
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;
}
