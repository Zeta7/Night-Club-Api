import { ApiProperty } from '@nestjs/swagger';
import { AuditSeverity, Prisma, UserRole } from '@prisma/client';
import { PaginationDto } from '../../../shared/presentation/response.dto';

export class AuditClubDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;
}

export class AuditActorDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  @ApiProperty({ type: 'string' })
  fullName!: string;
}

export class AuditEntryDto {
  @ApiProperty({ type: () => AuditClubDto, nullable: true })
  club!: AuditClubDto | null;

  @ApiProperty({ type: () => AuditActorDto })
  actor!: AuditActorDto;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ allOf: [{ $ref: '#/components/schemas/JsonValue' }], nullable: true })
  metadata!: Prisma.JsonValue;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  deviceFingerprint!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  clubId!: string | null;

  @ApiProperty({ type: 'string' })
  actorUserId!: string;

  @ApiProperty({ type: 'string' })
  resourceType!: string;

  @ApiProperty({ type: 'string' })
  resourceId!: string;

  @ApiProperty({ type: 'string' })
  action!: string;

  @ApiProperty({ type: 'string', nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  correlationId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  actorRoleSnapshot!: string | null;

  @ApiProperty({ enum: AuditSeverity, enumName: 'AuditSeverity' })
  severity!: AuditSeverity;

  @ApiProperty({ type: 'string', nullable: true })
  previousHash!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  integrityHash!: string | null;
}

export class AuditSearchResponseDto {
  @ApiProperty({ type: () => [AuditEntryDto] })
  items!: AuditEntryDto[];

  @ApiProperty({ type: () => PaginationDto })
  pagination!: PaginationDto;
}

export class AuditPolicyResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'integer' })
  retentionDays!: number;

  @ApiProperty({ type: 'string', nullable: true })
  updatedByUserId!: string | null;
}

export class AuditVerificationResponseDto {
  @ApiProperty({ type: 'boolean' })
  valid!: boolean;

  @ApiProperty({ type: 'integer' })
  checked!: number;

  @ApiProperty({ type: 'integer' })
  legacyUnchecked!: number;

  @ApiProperty({ type: 'string', nullable: true })
  brokenEntryId!: string | null;
}
