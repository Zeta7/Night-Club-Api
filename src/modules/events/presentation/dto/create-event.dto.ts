import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Fiesta de apertura' })
  @IsString({ message: 'El nombre del evento debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre del evento es obligatorio.' })
  @MaxLength(140, { message: 'El nombre del evento no debe superar 140 caracteres.' })
  name!: string;

  @ApiPropertyOptional({ example: 'Evento especial de apertura de temporada.' })
  @IsString({ message: 'La descripcion debe ser texto.' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'upload-id-uuid' })
  @IsString({ message: 'El upload de la imagen debe ser texto.' })
  @IsOptional()
  imageUploadId?: string;

  @ApiPropertyOptional({ example: true })
  @ValidateIf((object: CreateEventDto) => object.imageUploadId === undefined)
  @IsBoolean({ message: 'El indicador removeImage debe ser booleano.' })
  @IsOptional()
  removeImage?: boolean;

  @ApiProperty({ example: '2026-08-01T22:00:00.000Z' })
  @IsDateString({}, { message: 'La fecha de inicio debe tener formato ISO valido.' })
  startsAt!: string;

  @ApiProperty({ example: '2026-08-02T05:00:00.000Z' })
  @IsDateString({}, { message: 'La fecha de fin debe tener formato ISO valido.' })
  endsAt!: string;

  @ApiProperty({ example: 500, minimum: 1 })
  @IsInt({ message: 'El aforo debe ser un numero entero.' })
  @Min(1, { message: 'El aforo debe ser mayor a cero.' })
  capacity!: number;
}
