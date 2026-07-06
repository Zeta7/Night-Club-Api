import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTicketTypeDto {
  @ApiProperty({ example: 'Entrada General' })
  @IsString({ message: 'El nombre de la entrada debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre de la entrada es obligatorio.' })
  @MaxLength(120, { message: 'El nombre de la entrada no debe superar 120 caracteres.' })
  name!: string;

  @ApiPropertyOptional({ example: 'Acceso general a la discoteca o evento.' })
  @IsString({ message: 'La descripcion debe ser texto.' })
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 45.0, minimum: 0 })
  @IsNumber({}, { message: 'El precio debe ser numerico.' })
  @Min(0, { message: 'El precio no puede ser negativo.' })
  price!: number;

  @ApiPropertyOptional({ example: 'PEN' })
  @IsString({ message: 'La moneda debe ser texto.' })
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: 500, minimum: 1 })
  @IsInt({ message: 'La cantidad total debe ser un numero entero.' })
  @Min(1, { message: 'La cantidad total debe ser mayor a cero.' })
  quantityTotal!: number;

  @ApiPropertyOptional({ example: 4, minimum: 1 })
  @IsInt({ message: 'El limite por usuario debe ser entero.' })
  @Min(1, { message: 'El limite por usuario debe ser mayor a cero.' })
  @IsOptional()
  perUserLimit?: number;

  @ApiPropertyOptional({ example: '2026-08-01T18:00:00.000Z' })
  @IsDateString({}, { message: 'La fecha de inicio de venta debe ser ISO valida.' })
  @IsOptional()
  saleStartAt?: string;

  @ApiPropertyOptional({ example: '2026-08-02T04:00:00.000Z' })
  @IsDateString({}, { message: 'La fecha de fin de venta debe ser ISO valida.' })
  @IsOptional()
  saleEndAt?: string;
}
