import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @ApiProperty({ description: 'Refresh token que se desea revocar.' })
  @IsString({ message: 'El refresh token debe ser texto.' })
  @IsNotEmpty({ message: 'El refresh token es obligatorio.' })
  refreshToken!: string;
}
