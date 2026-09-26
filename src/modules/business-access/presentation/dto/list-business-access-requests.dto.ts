import { IsInteger, OptionalField } from '../../../../shared/presentation/dto-fields';
import { BusinessAccessRequestStatus, BusinessAccessRequestType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListBusinessAccessRequestsDto {
  @OptionalField()
  @IsEnum(BusinessAccessRequestStatus)
  status?: BusinessAccessRequestStatus;

  @OptionalField()
  @IsEnum(BusinessAccessRequestType)
  type?: BusinessAccessRequestType;

  @OptionalField()
  @IsString()
  @MaxLength(100)
  query?: string;

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
  pageSize = 20;
}
