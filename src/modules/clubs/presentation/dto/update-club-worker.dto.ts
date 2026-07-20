import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClubWorkerStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateClubWorkerDto {
  @ApiPropertyOptional({ enum: ClubWorkerStatus, example: ClubWorkerStatus.ACTIVE })
  @IsEnum(ClubWorkerStatus, { message: 'El estado del trabajador no es valido.' })
  @IsOptional()
  status?: ClubWorkerStatus;

  @ApiPropertyOptional({
    example: 'Portero',
    description: 'Rol operativo visible del trabajador dentro del club.',
  })
  @IsString({ message: 'El rol del trabajador debe ser texto.' })
  @MaxLength(80, { message: 'El rol del trabajador no puede exceder 80 caracteres.' })
  @IsOptional()
  roleLabel?: string;
}
