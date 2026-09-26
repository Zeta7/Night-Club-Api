import { IsInteger, OptionalField } from '../../../../shared/presentation/dto-fields';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class CreateTicketTypeDto {
  @ApiProperty({ example: 'Entrada General' })
  @IsString({ message: 'El nombre de la entrada debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre de la entrada es obligatorio.' })
  @MaxLength(120, { message: 'El nombre de la entrada no debe superar 120 caracteres.' })
  name!: string;

  @ApiPropertyOptional({ example: 'Acceso general al local nocturno o evento.' })
  @IsString({ message: 'La descripcion debe ser texto.' })
  @OptionalField({ nullable: true, type: String })
  description?: string | null;

  @ApiProperty({ example: 45.0, minimum: 0 })
  @IsNumber({}, { message: 'El precio debe ser numerico.' })
  @Min(0, { message: 'El precio no puede ser negativo.' })
  price!: number;

  @ApiPropertyOptional({ example: 'PEN' })
  @IsString({ message: 'La moneda debe ser texto.' })
  @OptionalField()
  currency?: string;

  @ApiProperty({ example: 500, minimum: 1 })
  @IsInteger({ message: 'La cantidad total debe ser un numero entero.' })
  @Min(1, { message: 'La cantidad total debe ser mayor a cero.' })
  quantityTotal!: number;

  @ApiPropertyOptional({ example: 4, minimum: 1 })
  @IsInteger({ message: 'El limite por usuario debe ser entero.' })
  @Min(1, { message: 'El limite por usuario debe ser mayor a cero.' })
  @OptionalField({ nullable: true, type: 'integer' })
  perUserLimit?: number | null;

  @ApiPropertyOptional({ example: '2026-08-01T18:00:00.000Z' })
  @IsDateString({}, { message: 'La fecha de inicio de venta debe ser ISO valida.' })
  @OptionalField({ nullable: true, type: String })
  saleStartAt?: string | null;

  @ApiPropertyOptional({ example: '2026-08-02T04:00:00.000Z' })
  @IsDateString({}, { message: 'La fecha de fin de venta debe ser ISO valida.' })
  @OptionalField({ nullable: true, type: String })
  saleEndAt?: string | null;
}
