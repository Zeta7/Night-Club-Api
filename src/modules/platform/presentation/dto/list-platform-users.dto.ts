import { IsInteger, OptionalField } from '../../../../shared/presentation/dto-fields';
import { UserRole, UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListPlatformUsersDto {
  @OptionalField()
  @IsString()
  @MaxLength(80)
  query?: string;

  @OptionalField()
  @IsEnum(UserRole)
  role?: UserRole;

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
