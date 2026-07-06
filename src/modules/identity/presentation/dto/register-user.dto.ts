import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterUserDto {
  @ApiProperty({ example: '+51', description: 'Código internacional del teléfono.' })
  @IsString({ message: 'El código de país debe ser texto.' })
  @IsNotEmpty({ message: 'El código de país es obligatorio.' })
  phoneCountryCode!: string;

  @ApiProperty({ example: '999999999', description: 'Número de teléfono sin código de país.' })
  @IsString({ message: 'El número de teléfono debe ser texto.' })
  @IsNotEmpty({ message: 'El número de teléfono es obligatorio.' })
  phoneNumber!: string;

  @ApiProperty({
    example: 'MyStrongPassword123',
    minLength: 8,
    description: 'Contraseña del usuario.',
  })
  @IsString({ message: 'La contraseña debe ser texto.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password!: string;

  @ApiProperty({ example: 'Juan Pérez', description: 'Nombre completo del usuario.' })
  @IsString({ message: 'El nombre completo debe ser texto.' })
  @IsNotEmpty({ message: 'El nombre completo es obligatorio.' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'juan@example.com', description: 'Correo opcional de contacto.' })
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  @IsOptional()
  email?: string;
}
