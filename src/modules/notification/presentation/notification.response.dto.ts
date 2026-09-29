import { ApiProperty } from '@nestjs/swagger';
import { NotificationAudience, NotificationCategory, Prisma } from '@prisma/client';

export class NotificationDto {
  @ApiProperty({ enum: NotificationAudience, enumName: 'NotificationAudience' })
  audience!: NotificationAudience;

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

export class NotificationUnreadCountsDto {
  @ApiProperty({
    type: 'integer',
    description: 'No leídas visibles en Cliente, sin filtros de categoría o lectura.',
  })
  customer!: number;

  @ApiProperty({
    type: 'integer',
    description: 'No leídas visibles en Operaciones, sin filtros de categoría o lectura.',
  })
  operations!: number;
}

export class NotificationsResponseDto {
  @ApiProperty({ type: () => NotificationUnreadCountsDto })
  unreadCounts!: NotificationUnreadCountsDto;

  @ApiProperty({
    type: 'string',
    nullable: true,
    description: 'Cursor para la siguiente página; null cuando no quedan más notificaciones.',
  })
  nextCursor!: string | null;

  @ApiProperty({ type: () => [NotificationDto] })
  items!: NotificationDto[];

  @ApiProperty({
    type: 'integer',
    description:
      'No leídas de audience seleccionado; total combinado al omitir audience. Ignora categoría y estado de lectura.',
  })
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
