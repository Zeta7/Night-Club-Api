import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: '+51', description: 'Codigo internacional del telefono.' })
  @IsString({ message: 'El codigo de pais debe ser texto.' })
  @IsNotEmpty({ message: 'El codigo de pais es obligatorio.' })
  phoneCountryCode!: string;

  @ApiProperty({ example: '999999999', description: 'Numero de telefono sin codigo de pais.' })
  @IsString({ message: 'El numero de telefono debe ser texto.' })
  @IsNotEmpty({ message: 'El numero de telefono es obligatorio.' })
  phoneNumber!: string;

  @ApiProperty({ example: '123456', minLength: 4, maxLength: 8 })
  @IsString({ message: 'El codigo de recuperacion debe ser texto.' })
  @Length(4, 8, { message: 'El codigo de recuperacion debe tener entre 4 y 8 caracteres.' })
  code!: string;

  @ApiProperty({ example: 'NuevaContrasena123', minLength: 8 })
  @IsString({ message: 'La nueva contrasena debe ser texto.' })
  @MinLength(8, { message: 'La nueva contrasena debe tener al menos 8 caracteres.' })
  newPassword!: string;
}
