import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({ example: '+51', description: 'Codigo internacional del telefono.' })
  @IsString({ message: 'El codigo de pais debe ser texto.' })
  @IsNotEmpty({ message: 'El codigo de pais es obligatorio.' })
  phoneCountryCode!: string;

  @ApiProperty({ example: '999999999', description: 'Numero de telefono sin codigo de pais.' })
  @IsString({ message: 'El numero de telefono debe ser texto.' })
  @IsNotEmpty({ message: 'El numero de telefono es obligatorio.' })
  phoneNumber!: string;
}
