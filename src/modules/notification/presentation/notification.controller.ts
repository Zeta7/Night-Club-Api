import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { NotificationService } from '../application/notification.service';
import {
  ListNotificationsQueryDto,
  RegisterDeviceDto,
  UpdateNotificationPreferenceDto,
} from './notification.dto';
import {
  NotificationPreferencesResponseDto,
  NotificationsResponseDto,
  ReadAllNotificationsResponseDto,
  ReadNotificationResponseDto,
  RegisteredNotificationDeviceResponseDto,
  RemovedNotificationDeviceResponseDto,
} from './notification.response.dto';

@ApiTags('Notification')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('me')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @ApiOperation({ summary: 'Listar mis notificaciones' })
  @ApiResponse({ status: 200, type: NotificationsResponseDto })
  @Get('notifications')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationsResponseDto> {
    return this.notifications.list(user.id, {
      category: query.category,
      readStatus: query.unreadOnly ? 'unread' : (query.readStatus ?? 'all'),
    });
  }

  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiResponse({ status: 200, type: ReadNotificationResponseDto })
  @Patch('notifications/:notificationId/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId') id: string,
  ): Promise<ReadNotificationResponseDto> {
    return this.notifications.markRead(user.id, id);
  }

  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  @ApiResponse({ status: 201, type: ReadAllNotificationsResponseDto })
  @Post('notifications/read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<ReadAllNotificationsResponseDto> {
    return this.notifications.markAllRead(user.id);
  }

  @ApiOperation({ summary: 'Obtener preferencias de notificación' })
  @ApiResponse({ status: 200, type: NotificationPreferencesResponseDto })
  @Get('notification-preferences')
  preferences(@CurrentUser() user: AuthenticatedUser): Promise<NotificationPreferencesResponseDto> {
    return this.notifications.getPreferences(user.id);
  }

  @ApiResponse({ status: 200, type: NotificationPreferencesResponseDto })
  @Patch('notification-preferences')
  updatePreference(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferencesResponseDto> {
    return this.notifications.updatePreference(user.id, body);
  }

  @ApiResponse({ status: 201, type: RegisteredNotificationDeviceResponseDto })
  @Post('devices')
  registerDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegisterDeviceDto,
  ): Promise<RegisteredNotificationDeviceResponseDto> {
    return this.notifications.registerDevice(user.id, body.token, body.platform);
  }

  @ApiResponse({ status: 200, type: RemovedNotificationDeviceResponseDto })
  @Delete('devices/:deviceId')
  removeDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deviceId') deviceId: string,
  ): Promise<RemovedNotificationDeviceResponseDto> {
    return this.notifications.removeDevice(user.id, deviceId);
  }
}
