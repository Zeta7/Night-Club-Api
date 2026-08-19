import { UserStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const manageableStatuses = [
  UserStatus.ACTIVE,
  UserStatus.INACTIVE,
  UserStatus.BLOCKED,
] as const;

export class ChangeUserStatusDto {
  @ApiProperty({ enum: manageableStatuses, example: UserStatus.ACTIVE })
  @IsIn(manageableStatuses, {
    message: 'El estado debe ser ACTIVE, INACTIVE o BLOCKED.',
  })
  status!: (typeof manageableStatuses)[number];
}
