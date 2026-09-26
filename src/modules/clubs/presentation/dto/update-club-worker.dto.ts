import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClubWorkerStatus } from '@prisma/client';
import { IsEnum, IsString, MaxLength } from 'class-validator';
import { OptionalField } from '../../../../shared/presentation/dto-fields';

export class UpdateClubWorkerDto {
  @ApiPropertyOptional({
    enum: ClubWorkerStatus,
    enumName: 'ClubWorkerStatus',
    example: ClubWorkerStatus.ACTIVE,
  })
  @IsEnum(ClubWorkerStatus, { message: 'El estado del trabajador no es valido.' })
  @OptionalField()
  status?: ClubWorkerStatus;

  @ApiPropertyOptional({
    example: 'Portero',
    description: 'Rol operativo visible del trabajador dentro del club.',
  })
  @IsString({ message: 'El rol del trabajador debe ser texto.' })
  @MaxLength(80, { message: 'El rol del trabajador no puede exceder 80 caracteres.' })
  @OptionalField({ nullable: true, type: String })
  roleLabel?: string | null;

  @IsString() @MaxLength(100) @OptionalField({ nullable: true, type: String }) assignedDoor?:
    string | null;
  @IsString() @MaxLength(100) @OptionalField({ nullable: true, type: String }) assignedZone?:
    string | null;
  @IsString() @MaxLength(100) @OptionalField({ nullable: true, type: String }) assignedPoint?:
    string | null;
}
