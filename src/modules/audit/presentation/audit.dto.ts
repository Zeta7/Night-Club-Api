import { AuditSeverity } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AuditQueryDto {
  @IsOptional() @IsUUID() clubId?: string;
  @IsOptional() @IsUUID() actorUserId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() resourceType?: string;
  @IsOptional() @IsString() resourceId?: string;
  @IsOptional() @IsEnum(AuditSeverity) severity?: AuditSeverity;
  @IsOptional() @IsString() correlationId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

export class UpdateAuditPolicyDto {
  @Type(() => Number) @IsInt() @Min(30) @Max(3650) retentionDays!: number;
}
