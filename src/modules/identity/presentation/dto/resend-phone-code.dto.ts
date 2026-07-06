import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResendPhoneCodeDto {
  @ApiProperty({ example: '+51', description: 'Código internacional del teléfono.' })
  @IsString({ message: 'El código de país debe ser texto.' })
  @IsNotEmpty({ message: 'El código de país es obligatorio.' })
  phoneCountryCode!: string;

  @ApiProperty({ example: '999999999', description: 'Número de teléfono sin código de país.' })
  @IsString({ message: 'El número de teléfono debe ser texto.' })
  @IsNotEmpty({ message: 'El número de teléfono es obligatorio.' })
  phoneNumber!: string;
}
