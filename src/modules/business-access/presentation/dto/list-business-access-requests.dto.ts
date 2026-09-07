import { BusinessAccessRequestStatus, BusinessAccessRequestType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListBusinessAccessRequestsDto {
  @IsOptional()
  @IsEnum(BusinessAccessRequestStatus)
  status?: BusinessAccessRequestStatus;

  @IsOptional()
  @IsEnum(BusinessAccessRequestType)
  type?: BusinessAccessRequestType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
