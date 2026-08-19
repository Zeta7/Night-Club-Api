import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from '../application/notification.service';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import {
  ListNotificationsQueryDto,
  RegisterDeviceDto,
  UpdateNotificationPreferenceDto,
} from './notification.dto';

@UseGuards(AccessTokenGuard)
@Controller('me')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get('notifications')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListNotificationsQueryDto) {
    return this.notifications.list(user.id, {
      category: query.category,
      readStatus: query.unreadOnly ? 'unread' : (query.readStatus ?? 'all'),
    });
  }

  @Patch('notifications/:notificationId/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('notificationId') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('notifications/read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Get('notification-preferences')
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.getPreferences(user.id);
  }

  @Patch('notification-preferences')
  updatePreference(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateNotificationPreferenceDto,
  ) {
    return this.notifications.updatePreference(user.id, body);
  }

  @Post('devices')
  registerDevice(@CurrentUser() user: AuthenticatedUser, @Body() body: RegisterDeviceDto) {
    return this.notifications.registerDevice(user.id, body.token, body.platform);
  }

  @Delete('devices/:deviceId')
  removeDevice(@CurrentUser() user: AuthenticatedUser, @Param('deviceId') deviceId: string) {
    return this.notifications.removeDevice(user.id, deviceId);
  }
}
