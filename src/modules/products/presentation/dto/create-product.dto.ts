import { IsInteger, OptionalField } from '../../../../shared/presentation/dto-fields';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Whisky Red Label 750ml' })
  @IsString({ message: 'El nombre del producto debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre del producto es obligatorio.' })
  @MaxLength(140, { message: 'El nombre del producto no debe superar 140 caracteres.' })
  name!: string;

  @ApiPropertyOptional({ example: 'Botella de whisky para venta en barra.' })
  @IsString({ message: 'La descripcion debe ser texto.' })
  @OptionalField({ nullable: true, type: String })
  description?: string | null;

  @ApiPropertyOptional({ example: 'upload-id-uuid' })
  @IsString({ message: 'El upload de la imagen debe ser texto.' })
  @OptionalField()
  imageUploadId?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean({ message: 'El indicador removeImage debe ser booleano.' })
  @OptionalField()
  removeImage?: boolean;

  @ApiProperty({ example: 35.5 })
  @IsNumber({}, { message: 'El precio debe ser un numero valido.' })
  @Min(0, { message: 'El precio no puede ser negativo.' })
  price!: number;

  @ApiPropertyOptional({ example: 'PEN' })
  @IsString({ message: 'La moneda debe ser texto.' })
  @OptionalField()
  currency?: string;

  @ApiProperty({ example: 24, minimum: 0 })
  @IsInteger({ message: 'El stock debe ser un numero entero.' })
  @Min(0, { message: 'El stock no puede ser negativo.' })
  stockQuantity!: number;
}
