import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export enum UploadResourceType {
  CLUB = 'CLUB',
  EVENT = 'EVENT',
}

export class CreatePresignedUploadUrlDto {
  @ApiProperty({ enum: UploadResourceType, example: UploadResourceType.CLUB })
  @IsEnum(UploadResourceType, { message: 'El tipo de recurso no es valido.' })
  resourceType!: UploadResourceType;

  @ApiProperty({ example: 'club-or-event-id' })
  @IsString({ message: 'El ID del recurso debe ser texto.' })
  @IsNotEmpty({ message: 'El ID del recurso es obligatorio.' })
  resourceId!: string;

  @ApiProperty({ example: 'cover.png', maxLength: 180 })
  @IsString({ message: 'El nombre del archivo debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre del archivo es obligatorio.' })
  @MaxLength(180, { message: 'El nombre del archivo no debe superar 180 caracteres.' })
  fileName!: string;

  @ApiProperty({ example: 'image/png' })
  @IsString({ message: 'El tipo de contenido debe ser texto.' })
  @IsNotEmpty({ message: 'El tipo de contenido es obligatorio.' })
  contentType!: string;

  @ApiProperty({ example: 1048576, minimum: 1, maximum: 5242880 })
  @IsInt({ message: 'El tamano del archivo debe ser un numero entero.' })
  @Min(1, { message: 'El tamano del archivo debe ser mayor a cero.' })
  @Max(5 * 1024 * 1024, { message: 'La imagen no debe superar 5 MB.' })
  sizeBytes!: number;
}
