import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CustomerExploreQueryDto {
  @ApiPropertyOptional({
    example: 'Lima',
    description:
      'Omitir para el catálogo nacional; con al menos 2 caracteres busca negocios, ciudades, eventos, promociones o productos.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'La búsqueda debe ser texto.' })
  @MinLength(2, { message: 'Escribe al menos 2 caracteres para buscar.' })
  @MaxLength(120, { message: 'La búsqueda no debe superar 120 caracteres.' })
  q?: string;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    description: 'Página del catálogo nacional, con 30 elementos por categoría.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
