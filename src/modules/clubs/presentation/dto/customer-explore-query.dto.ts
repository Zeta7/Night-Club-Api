import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CustomerExploreQueryDto {
  @ApiProperty({
    example: 'Lima',
    description: 'Nombre de negocio, ciudad, evento, promoción o producto.',
  })
  @IsString({ message: 'La búsqueda debe ser texto.' })
  @MinLength(2, { message: 'Escribe al menos 2 caracteres para buscar.' })
  @MaxLength(120, { message: 'La búsqueda no debe superar 120 caracteres.' })
  q!: string;
}
