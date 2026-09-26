import { ApiProperty } from '@nestjs/swagger';
import { NotificationCategory, Prisma } from '@prisma/client';

export class NotificationDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ enum: NotificationCategory, enumName: 'NotificationCategory' })
  category!: NotificationCategory;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string' })
  userId!: string;

  @ApiProperty({ allOf: [{ $ref: '#/components/schemas/JsonValue' }], nullable: true })
  data!: Prisma.JsonValue;

  @ApiProperty({ type: 'string', nullable: true })
  templateKey!: string | null;

  @ApiProperty({ type: 'integer', nullable: true })
  templateVersion!: number | null;

  @ApiProperty({ type: 'string' })
  body!: string;

  @ApiProperty({ type: 'string', nullable: true })
  deepLink!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  readAt!: Date | null;
}

export class NotificationsResponseDto {
  @ApiProperty({ type: () => [NotificationDto] })
  items!: NotificationDto[];

  @ApiProperty({ type: 'integer' })
  unreadCount!: number;
}

export class ReadNotificationResponseDto {
  @ApiProperty({ type: 'string' })
  notificationId!: string;

  @ApiProperty({ type: 'boolean' })
  read!: boolean;
}

export class ReadAllNotificationsResponseDto {
  @ApiProperty({ type: 'integer' })
  updated!: number;
}

export class NotificationPreferenceDto {
  @ApiProperty({ enum: NotificationCategory, enumName: 'NotificationCategory' })
  category!: NotificationCategory;

  @ApiProperty({ type: 'boolean' })
  inAppEnabled!: boolean;

  @ApiProperty({ type: 'boolean' })
  pushEnabled!: boolean;

  @ApiProperty({ type: 'boolean' })
  smsEnabled!: boolean;

  @ApiProperty({ type: 'boolean' })
  emailEnabled!: boolean;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty({ type: () => [NotificationPreferenceDto] })
  items!: NotificationPreferenceDto[];
}

export class RegisteredNotificationDeviceResponseDto {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  token!: string;

  @ApiProperty({ type: 'string' })
  platform!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: 'string' })
  userId!: string;

  @ApiProperty({ type: 'boolean' })
  enabled!: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  lastSeenAt!: Date;
}

export class RemovedNotificationDeviceResponseDto {
  @ApiProperty({ type: 'string' })
  deviceId!: string;

  @ApiProperty({ type: 'boolean' })
  enabled!: boolean;
}
