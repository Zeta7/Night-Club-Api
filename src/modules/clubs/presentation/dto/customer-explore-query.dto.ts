import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { OptionalField } from '../../../../shared/presentation/dto-fields';

export class CustomerExploreQueryDto {
  @OptionalField({
    example: 'Lima',
    description:
      'Omitir para el catálogo nacional; con al menos 2 caracteres busca negocios, ciudades, eventos, promociones o productos.',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'La búsqueda debe ser texto.' })
  @MinLength(2, { message: 'Escribe al menos 2 caracteres para buscar.' })
  @MaxLength(120, { message: 'La búsqueda no debe superar 120 caracteres.' })
  q?: string;

  @OptionalField({
    type: 'integer',
    minimum: 1,
    description: 'Página del catálogo nacional, con 30 elementos por categoría.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
