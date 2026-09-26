import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsInteger, OptionalField } from '../../../../shared/presentation/dto-fields';

export class ListPlatformUsersDto {
  @OptionalField()
  @IsString()
  @MaxLength(80)
  query?: string;

  @ApiPropertyOptional({ enum: UserRole, enumName: 'UserRole' })
  @OptionalField()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, enumName: 'UserStatus' })
  @OptionalField()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @OptionalField()
  @Transform(({ value }) => Number(value))
  @IsInteger()
  @Min(1)
  page = 1;

  @OptionalField()
  @Transform(({ value }) => Number(value))
  @IsInteger()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
