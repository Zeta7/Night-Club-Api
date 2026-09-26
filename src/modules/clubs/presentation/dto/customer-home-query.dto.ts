import { OptionalField } from '../../../../shared/presentation/dto-fields';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CustomerHomeQueryDto {
  @ApiPropertyOptional({ example: 'Miraflores' })
  @OptionalField()
  @IsString({ message: 'El distrito debe ser texto.' })
  @MaxLength(120, { message: 'El distrito no debe superar 120 caracteres.' })
  district?: string;

  @ApiPropertyOptional({ example: 'Lima' })
  @OptionalField()
  @IsString({ message: 'La provincia debe ser texto.' })
  @MaxLength(120, { message: 'La provincia no debe superar 120 caracteres.' })
  province?: string;

  @ApiPropertyOptional({ example: 'Lima' })
  @OptionalField()
  @IsString({ message: 'El departamento debe ser texto.' })
  @MaxLength(120, { message: 'El departamento no debe superar 120 caracteres.' })
  department?: string;
}
