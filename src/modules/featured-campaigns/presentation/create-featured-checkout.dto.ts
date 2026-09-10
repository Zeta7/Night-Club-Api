import { FeaturedTargetType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFeaturedCheckoutDto {
  @ApiProperty({ enum: FeaturedTargetType })
  @IsEnum(FeaturedTargetType)
  targetType!: FeaturedTargetType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiProperty({ description: 'Clave estable para evitar cobros duplicados.' })
  @IsString()
  @MinLength(12)
  @MaxLength(120)
  idempotencyKey!: string;
}
