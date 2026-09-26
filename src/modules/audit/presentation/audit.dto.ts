import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditSeverity } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsString, IsUUID, Max, Min } from 'class-validator';
import { IsInteger, OptionalField } from '../../../shared/presentation/dto-fields';

export class AuditQueryDto {
  @OptionalField() @IsUUID() clubId?: string;
  @OptionalField() @IsUUID() actorUserId?: string;
  @OptionalField() @IsString() action?: string;
  @OptionalField() @IsString() resourceType?: string;
  @OptionalField() @IsString() resourceId?: string;
  @ApiPropertyOptional({ enum: AuditSeverity, enumName: 'AuditSeverity' })
  @OptionalField()
  @IsEnum(AuditSeverity)
  severity?: AuditSeverity;
  @OptionalField() @IsString() correlationId?: string;
  @OptionalField({ format: 'date-time' }) @IsDateString() from?: string;
  @OptionalField({ format: 'date-time' }) @IsDateString() to?: string;
  @OptionalField() @Type(() => Number) @IsInteger() @Min(1) page = 1;
  @OptionalField() @Type(() => Number) @IsInteger() @Min(1) @Max(100) pageSize = 25;
}

export class UpdateAuditPolicyDto {
  @Type(() => Number) @IsInteger() @Min(30) @Max(3650) retentionDays!: number;
}
