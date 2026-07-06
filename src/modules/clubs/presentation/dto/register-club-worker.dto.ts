import { ApiProperty } from '@nestjs/swagger';
import { WorkerPermission } from '@prisma/client';
import { ArrayUnique, IsArray, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class RegisterClubWorkerDto {
  @ApiProperty({ description: 'ID del usuario que sera trabajador del club.' })
  @IsString({ message: 'El ID del usuario debe ser texto.' })
  @IsNotEmpty({ message: 'El ID del usuario es obligatorio.' })
  userId!: string;

  @ApiProperty({
    enum: WorkerPermission,
    isArray: true,
    example: [WorkerPermission.VALIDATE_TICKETS],
  })
  @IsArray({ message: 'Los permisos deben enviarse como una lista.' })
  @ArrayUnique({ message: 'Los permisos no deben repetirse.' })
  @IsEnum(WorkerPermission, { each: true, message: 'Uno o mas permisos enviados no son validos.' })
  permissions!: WorkerPermission[];
}
