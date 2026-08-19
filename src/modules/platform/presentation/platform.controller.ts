import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { PlatformService } from '../application/platform.service';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { ListPlatformUsersDto } from './dto/list-platform-users.dto';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, SuperAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Obtener dashboard global de plataforma (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para consultar el panel global de administracion con metricas generales de usuarios, clubes y configuracion de la plataforma.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard global obtenido correctamente.' })
  getDashboard() {
    return this.platformService.getDashboard();
  }

  @Get('users')
  @ApiOperation({
    summary: 'Listar usuarios de plataforma (SUPER_ADMIN)',
    description:
      'Devuelve usuarios paginados y permite filtrar por texto, rol y estado para el panel de Super Admin.',
  })
  @ApiResponse({ status: 200, description: 'Usuarios de plataforma obtenidos correctamente.' })
  listUsers(@Query() query: ListPlatformUsersDto) {
    return this.platformService.listUsers(query);
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Actualizar configuracion global de plataforma (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para modificar parametros globales que afectan el comportamiento general de la plataforma.',
  })
  @ApiResponse({ status: 200, description: 'Configuracion actualizada correctamente.' })
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdatePlatformSettingsDto) {
    return this.platformService.updateSettings(user, body);
  }

  @Patch('users/:userId/role')
  @ApiOperation({
    summary: 'Cambiar rol de usuario (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para asignar o cambiar el rol global de un usuario dentro de la plataforma.',
  })
  @ApiResponse({ status: 200, description: 'Rol actualizado correctamente.' })
  changeUserRole(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string, @Body() body: ChangeUserRoleDto) {
    return this.platformService.changeUserRole(user, userId, body);
  }

  @Patch('users/:userId/status')
  @ApiOperation({
    summary: 'Cambiar estado de cualquier usuario (SUPER_ADMIN)',
    description:
      'Permite asignar ACTIVE, INACTIVE o BLOCKED a cualquier cuenta de la plataforma.',
  })
  @ApiResponse({ status: 200, description: 'Estado de usuario actualizado correctamente.' })
  changeUserStatus(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string, @Body() body: ChangeUserStatusDto) {
    return this.platformService.changeUserStatus(user, userId, body);
  }

  @Patch('users/:userId/activate')
  @ApiOperation({
    summary: 'Activar usuario (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para reactivar o habilitar un usuario, permitiendo que pueda operar nuevamente segun su rol.',
  })
  @ApiResponse({ status: 200, description: 'Usuario activado correctamente.' })
  activateUser(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string) {
    return this.platformService.activateUser(user, userId);
  }

  @Patch('users/:userId/deactivate')
  @ApiOperation({
    summary: 'Desactivar usuario (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para bloquear operativamente un usuario e impedir que siga usando funcionalidades protegidas.',
  })
  @ApiResponse({ status: 200, description: 'Usuario desactivado correctamente.' })
  deactivateUser(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string) {
    return this.platformService.deactivateUser(user, userId);
  }

  @Patch('users/:userId/block')
  @ApiOperation({
    summary: 'Bloquear cualquier usuario (SUPER_ADMIN)',
    description:
      'Bloquea una cuenta CUSTOMER, WORKER, ADMIN o SUPER_ADMIN.',
  })
  @ApiResponse({ status: 200, description: 'Usuario bloqueado correctamente.' })
  blockUser(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string) {
    return this.platformService.blockUser(user, userId);
  }
}
