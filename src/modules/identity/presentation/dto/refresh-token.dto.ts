import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token entregado durante el inicio de sesion.' })
  @IsString({ message: 'El refresh token debe ser texto.' })
  @IsNotEmpty({ message: 'El refresh token es obligatorio.' })
  refreshToken!: string;
}
