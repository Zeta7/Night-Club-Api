import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationCategory } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { OptionalField } from '../../../shared/presentation/dto-fields';

export class UpdateNotificationPreferenceDto {
  @ApiProperty({ enum: NotificationCategory, enumName: 'NotificationCategory' })
  @IsEnum(NotificationCategory)
  category!: NotificationCategory;

  @OptionalField() @IsBoolean() inAppEnabled?: boolean;
  @OptionalField() @IsBoolean() pushEnabled?: boolean;
  @OptionalField() @IsBoolean() smsEnabled?: boolean;
  @OptionalField() @IsBoolean() emailEnabled?: boolean;
}

export class RegisterDeviceDto {
  @IsString() @MaxLength(2048) token!: string;
  @IsString() @MaxLength(30) platform!: string;
}

export class ListNotificationsQueryDto {
  @OptionalField({
    type: 'string',
    maxLength: 512,
    description:
      'Cursor opaco nextCursor de la página anterior. Omitir al cambiar filtros o actualizar.',
  })
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @OptionalField({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 100,
    description: 'Cantidad máxima de notificaciones por página.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @OptionalField()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ enum: NotificationCategory, enumName: 'NotificationCategory' })
  @OptionalField()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @OptionalField()
  @IsIn(['all', 'unread', 'read'])
  readStatus?: 'all' | 'unread' | 'read';
}
