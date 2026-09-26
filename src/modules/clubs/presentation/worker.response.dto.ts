import { ApiProperty } from '@nestjs/swagger';
import {
  ClubWorkerStatus,
  UserRole,
  UserStatus,
  WorkerDeviceStatus,
  WorkerPermission,
  WorkerShiftStatus,
} from '@prisma/client';

export class WorkerShiftDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: WorkerShiftStatus, enumName: 'WorkerShiftStatus' })
  status!: WorkerShiftStatus;

  @ApiProperty({ type: 'string', nullable: true })
  assignedDoor!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  assignedZone!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  assignedPoint!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  deviceFingerprint!: string | null;

  @ApiProperty({ type: 'string' })
  workerId!: string;

  @ApiProperty({ type: 'string' })
  openedByUserId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  closedByUserId!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  startedAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  endedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  closeReason!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  lastActivityAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  lastSyncAt!: Date | null;
}

export class WorkerShiftResponseDto {
  @ApiProperty({ type: () => WorkerShiftDto })
  shift!: WorkerShiftDto;
}

export class WorkerShiftSyncResponseDto {
  @ApiProperty({ type: 'string' })
  shiftId!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  syncedAt!: Date;
}

export class WorkerShiftEventDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;
}

export class WorkerShiftDetailDto {
  @ApiProperty({ type: () => WorkerShiftEventDto, nullable: true })
  event!: WorkerShiftEventDto | null;

  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: WorkerShiftStatus, enumName: 'WorkerShiftStatus' })
  status!: WorkerShiftStatus;

  @ApiProperty({ type: 'string', nullable: true })
  assignedDoor!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  assignedZone!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  assignedPoint!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  eventId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  deviceFingerprint!: string | null;

  @ApiProperty({ type: 'string' })
  workerId!: string;

  @ApiProperty({ type: 'string' })
  openedByUserId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  closedByUserId!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  startedAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  endedAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  closeReason!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  lastActivityAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  lastSyncAt!: Date | null;
}

export class WorkerShiftsResponseDto {
  @ApiProperty({ type: () => [WorkerShiftDetailDto] })
  items!: WorkerShiftDetailDto[];
}

export class ClosedWorkerShiftResponseDto {
  @ApiProperty({ type: 'string' })
  shiftId!: string;

  @ApiProperty({ enum: WorkerShiftStatus, enumName: 'WorkerShiftStatus' })
  status!: WorkerShiftStatus;

  @ApiProperty({ type: 'string', format: 'date-time' })
  endedAt!: Date;
}

export class WorkerDeviceDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  platform!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ enum: WorkerDeviceStatus, enumName: 'WorkerDeviceStatus' })
  status!: WorkerDeviceStatus;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  lastSeenAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  revokedAt!: Date | null;

  @ApiProperty({ type: 'string' })
  fingerprint!: string;

  @ApiProperty({ type: 'string' })
  workerId!: string;

  @ApiProperty({ type: 'string' })
  authorizedByUserId!: string;

  @ApiProperty({ type: 'string', nullable: true })
  revokedByUserId!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  authorizedAt!: Date;
}

export class WorkerDeviceResponseDto {
  @ApiProperty({ type: () => WorkerDeviceDto })
  device!: WorkerDeviceDto;
}

export class RevokedWorkerDeviceResponseDto {
  @ApiProperty({ type: 'string' })
  deviceId!: string;

  @ApiProperty({ enum: WorkerDeviceStatus, enumName: 'WorkerDeviceStatus' })
  status!: WorkerDeviceStatus;
}

export class WorkerOperationsReportResponseDto {
  @ApiProperty({ type: 'string' })
  workerId!: string;

  @ApiProperty({ type: () => [WorkerShiftDto] })
  shifts!: WorkerShiftDto[];

  @ApiProperty({ type: 'object', additionalProperties: { type: 'integer' } })
  validations!: Record<string, number>;

  @ApiProperty({ type: 'integer' })
  auditedActions!: number;

  @ApiProperty({ type: () => [WorkerDeviceDto] })
  devices!: WorkerDeviceDto[];
}

export class WorkerUserDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  fullName!: string;

  @ApiProperty({ type: 'string' })
  phoneCountryCode!: string;

  @ApiProperty({ type: 'string' })
  phoneNumber!: string;

  @ApiProperty({ type: 'string', nullable: true })
  email!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  profileImage!: string | null;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status!: UserStatus;
}

export class ClubWorkerDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  clubId!: string;

  @ApiProperty({ type: 'string' })
  userId!: string;

  @ApiProperty({ enum: ClubWorkerStatus, enumName: 'ClubWorkerStatus' })
  status!: ClubWorkerStatus;

  @ApiProperty({ type: 'string', nullable: true })
  roleLabel!: string | null;

  @ApiProperty({ enum: WorkerPermission, enumName: 'WorkerPermission', isArray: true })
  permissions!: WorkerPermission[];

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string', nullable: true })
  assignedDoor!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  assignedZone!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  assignedPoint!: string | null;

  @ApiProperty({ type: () => WorkerUserDto })
  user!: WorkerUserDto;
}

export class ClubWorkerResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => ClubWorkerDto })
  worker!: ClubWorkerDto;
}

export class ClubWorkersResponseDto {
  @ApiProperty({ type: 'string' })
  message!: string;

  @ApiProperty({ type: () => [ClubWorkerDto] })
  workers!: ClubWorkerDto[];
}
