import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessAccessRequestType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateBusinessAccessRequestDto {
  @ApiProperty({ enum: BusinessAccessRequestType })
  @IsEnum(BusinessAccessRequestType)
  type!: BusinessAccessRequestType;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  businessName!: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxId?: string;

  @ApiProperty({ description: 'Ciudad o distrito del negocio.', maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  location!: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  socialUrl?: string;

  @ApiPropertyOptional({
    description: 'Obligatorio al solicitar administrar un negocio existente.',
  })
  @ValidateIf(
    (value: CreateBusinessAccessRequestDto) =>
      value.type === BusinessAccessRequestType.ADMINISTER_EXISTING_BUSINESS,
  )
  @IsUUID()
  requestedClubId?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @ApiProperty({ description: 'Aceptación explícita de revisión por Beerry.' })
  @IsBoolean()
  acceptedReview!: boolean;
}
