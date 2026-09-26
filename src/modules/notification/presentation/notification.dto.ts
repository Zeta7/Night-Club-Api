import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsString, MaxLength } from 'class-validator';
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
