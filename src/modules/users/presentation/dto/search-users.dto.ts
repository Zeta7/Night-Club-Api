import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SearchUsersDto {
  @ApiProperty({ example: 'juan', minLength: 2, maxLength: 80 })
  @IsString({ message: 'La busqueda debe ser texto.' })
  @IsNotEmpty({ message: 'La busqueda es obligatoria.' })
  @MinLength(2, { message: 'La busqueda debe tener al menos 2 caracteres.' })
  @MaxLength(80, { message: 'La busqueda no debe superar 80 caracteres.' })
  query!: string;
}
