import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ConfirmPhoneDto {
  @ApiProperty({ example: '+51', description: 'Código internacional del teléfono.' })
  @IsString({ message: 'El código de país debe ser texto.' })
  @IsNotEmpty({ message: 'El código de país es obligatorio.' })
  phoneCountryCode!: string;

  @ApiProperty({ example: '999999999', description: 'Número de teléfono sin código de país.' })
  @IsString({ message: 'El número de teléfono debe ser texto.' })
  @IsNotEmpty({ message: 'El número de teléfono es obligatorio.' })
  phoneNumber!: string;

  @ApiProperty({
    example: '123456',
    minLength: 4,
    maxLength: 8,
    description: 'Código de confirmación recibido por el usuario.',
  })
  @IsString({ message: 'El código de confirmación debe ser texto.' })
  @Length(4, 8, { message: 'El código de confirmación debe tener entre 4 y 8 caracteres.' })
  code!: string;
}
