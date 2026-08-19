import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { NotificationCategory } from '@prisma/client';

export class UpdateNotificationPreferenceDto {
  @IsEnum(NotificationCategory)
  category!: NotificationCategory;

  @IsOptional() @IsBoolean() inAppEnabled?: boolean;
  @IsOptional() @IsBoolean() pushEnabled?: boolean;
  @IsOptional() @IsBoolean() smsEnabled?: boolean;
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
}

export class RegisterDeviceDto {
  @IsString() @MaxLength(2048) token!: string;
  @IsString() @MaxLength(30) platform!: string;
}

export class ListNotificationsQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @IsOptional()
  @IsIn(['all', 'unread', 'read'])
  readStatus?: 'all' | 'unread' | 'read';
}
