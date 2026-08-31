import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreatePresignedUploadUrlDto {
  @ApiProperty({ example: 'cover.png', maxLength: 180 })
  @IsString({ message: 'El nombre del archivo debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre del archivo es obligatorio.' })
  @MaxLength(180, { message: 'El nombre del archivo no debe superar 180 caracteres.' })
  fileName!: string;

  @ApiProperty({ example: 'image/png' })
  @IsString({ message: 'El tipo de contenido debe ser texto.' })
  @IsNotEmpty({ message: 'El tipo de contenido es obligatorio.' })
  contentType!: string;

  @ApiProperty({ example: 1048576, minimum: 1, maximum: 10485760 })
  @IsInt({ message: 'El tamano del archivo debe ser un numero entero.' })
  @Min(1, { message: 'El tamano del archivo debe ser mayor a cero.' })
  @Max(10 * 1024 * 1024, { message: 'La imagen no debe superar 10 MB.' })
  sizeBytes!: number;

  @ApiPropertyOptional({ example: 'local-nocturno-nebula', maxLength: 120 })
  @IsOptional()
  @IsString({ message: 'La carpeta del upload debe ser texto.' })
  @MaxLength(120, { message: 'La carpeta del upload no debe superar 120 caracteres.' })
  folderName?: string;
}
