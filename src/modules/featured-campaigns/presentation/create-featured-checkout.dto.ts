import { FeaturedTargetType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFeaturedCheckoutDto {
  @ApiProperty({ enum: FeaturedTargetType })
  @IsEnum(FeaturedTargetType)
  targetType!: FeaturedTargetType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiProperty({ description: 'Cantidad de días a contratar.', minimum: 1, maximum: 90 })
  @IsInt()
  @Min(1)
  @Max(90)
  durationDays!: number;

  @ApiProperty({ description: 'Clave estable para evitar cobros duplicados.' })
  @IsString()
  @MinLength(12)
  @MaxLength(120)
  idempotencyKey!: string;
}
