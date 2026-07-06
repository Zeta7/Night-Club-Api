import { ApiProperty } from '@nestjs/swagger';
import { WorkerPermission } from '@prisma/client';
import { ArrayUnique, IsArray, IsEnum } from 'class-validator';

export class ReplaceClubWorkerPermissionsDto {
  @ApiProperty({
    enum: WorkerPermission,
    isArray: true,
    example: [WorkerPermission.VALIDATE_PRODUCTS, WorkerPermission.VALIDATE_PROMOTIONS],
  })
  @IsArray({ message: 'Los permisos deben enviarse como una lista.' })
  @ArrayUnique({ message: 'Los permisos no deben repetirse.' })
  @IsEnum(WorkerPermission, { each: true, message: 'Uno o mas permisos enviados no son validos.' })
  permissions!: WorkerPermission[];
}
