import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ClubWorkerStatus,
  CommerceItemType,
  EventStatus,
  RedeemableStatus,
  UserRole,
  WorkerPermission,
} from '@prisma/client';
import { OperationsLowStockDto } from './commerce.response.dto';

export class CommerceOperationsSalesTodayDto {
  @ApiProperty({ type: 'integer' })
  amountCents!: number;

  @ApiProperty({ type: 'integer' })
  orders!: number;

  @ApiProperty({ type: 'string' })
  currency!: string;
}

export class CommerceOperationsInventoryDto {
  @ApiProperty({ type: () => [OperationsLowStockDto] })
  lowStock!: OperationsLowStockDto[];

  @ApiProperty({ type: () => [OperationsLowStockDto] })
  outOfStock!: OperationsLowStockDto[];
}

export class CommerceOperationsEventDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'integer' })
  capacity!: number;

  @ApiProperty({ type: 'integer' })
  admitted!: number;

  @ApiProperty({ type: 'integer' })
  available!: number;

  @ApiProperty({ type: 'number' })
  occupancyPercent!: number;

  @ApiProperty({ enum: EventStatus, enumName: 'EventStatus' })
  status!: EventStatus;
}

export class CommerceOperationsWorkerDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ enum: ClubWorkerStatus, enumName: 'ClubWorkerStatus' })
  status!: ClubWorkerStatus;

  @ApiProperty({ enum: WorkerPermission, enumName: 'WorkerPermission', isArray: true })
  permissions!: WorkerPermission[];

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}

export class CommerceOperationsDeviceDto {
  @ApiProperty({ type: 'boolean' })
  online!: boolean;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  platform!: string;

  @ApiProperty({ type: 'string' })
  userId!: string;

  @ApiProperty({ type: 'boolean' })
  enabled!: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  lastSeenAt!: Date;
}

export class CommerceOperationsResponseDto {
  @ApiProperty({ type: 'string', format: 'date-time' })
  generatedAt!: Date;

  @ApiProperty({ type: () => CommerceOperationsSalesTodayDto })
  salesToday!: CommerceOperationsSalesTodayDto;

  @ApiProperty({ type: () => CommerceOperationsInventoryDto })
  inventory!: CommerceOperationsInventoryDto;

  @ApiProperty({ type: () => [CommerceOperationsEventDto] })
  events!: CommerceOperationsEventDto[];

  @ApiProperty({ type: 'object', additionalProperties: { type: 'integer' } })
  validationsToday!: Record<string, number>;

  @ApiProperty({ type: () => [CommerceOperationsWorkerDto] })
  workers!: CommerceOperationsWorkerDto[];

  @ApiProperty({ type: () => [CommerceOperationsDeviceDto] })
  devices!: CommerceOperationsDeviceDto[];
}

export class CodeValidationDto {
  @ApiProperty({ type: 'boolean' })
  isValid!: boolean;

  @ApiProperty({ type: 'string' })
  statusLabel!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: 'string' })
  attendeeName!: string;

  @ApiProperty({ type: 'string' })
  attendeeReference!: string;

  @ApiProperty({ type: 'string' })
  accessTypeLabel!: string;

  @ApiProperty({ type: 'string' })
  accessName!: string;

  @ApiProperty({ type: 'string' })
  eventDateLabel!: string;

  @ApiProperty({ type: 'string' })
  scanTimeLabel!: string;

  @ApiProperty({ type: 'string' })
  transactionId!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  attendeeImageUrl?: string | null;

  @ApiPropertyOptional({ type: 'string' })
  validatedByName?: string;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  validatedAt?: string | null;
}

export class CodeValidationResponseDto {
  @ApiProperty({ type: () => CodeValidationDto })
  validation!: CodeValidationDto;
}

export class RedemptionReversalResponseDto {
  @ApiProperty({ type: 'string' })
  resourceId!: string;

  @ApiProperty({ enum: CommerceItemType, enumName: 'CommerceItemType' })
  kind!: CommerceItemType;

  @ApiProperty({ enum: RedeemableStatus, enumName: 'RedeemableStatus' })
  status!: RedeemableStatus;

  @ApiProperty({ type: 'integer' })
  redemptionCount!: number;

  @ApiProperty({ type: 'boolean' })
  reversed!: boolean;
}

export class RedemptionAuditEntryDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  actorUserId!: string;

  @ApiProperty({ type: 'string' })
  actorName!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  actorRole!: UserRole;

  @ApiProperty({ type: 'string' })
  action!: string;

  @ApiProperty({ type: 'string' })
  resourceType!: string;

  @ApiProperty({ type: 'string' })
  resourceId!: string;

  @ApiProperty({ type: 'string' })
  accessName!: string;

  @ApiProperty({ type: 'string', nullable: true })
  eventName!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;
}

export class RedemptionAuditResponseDto {
  @ApiProperty({ type: () => [RedemptionAuditEntryDto] })
  items!: RedemptionAuditEntryDto[];
}
