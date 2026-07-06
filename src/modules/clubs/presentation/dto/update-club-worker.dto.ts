import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClubWorkerStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateClubWorkerDto {
  @ApiPropertyOptional({ enum: ClubWorkerStatus, example: ClubWorkerStatus.ACTIVE })
  @IsEnum(ClubWorkerStatus, { message: 'El estado del trabajador no es valido.' })
  @IsOptional()
  status?: ClubWorkerStatus;
}
