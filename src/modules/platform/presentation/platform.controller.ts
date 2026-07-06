import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { PlatformService } from '../application/platform.service';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { SuperAdminGuard } from './guards/super-admin.guard';

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

  @Patch('settings')
  @ApiOperation({
    summary: 'Actualizar configuracion global de plataforma (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para modificar parametros globales que afectan el comportamiento general de la plataforma.',
  })
  @ApiResponse({ status: 200, description: 'Configuracion actualizada correctamente.' })
  updateSettings(@Body() body: UpdatePlatformSettingsDto) {
    return this.platformService.updateSettings(body);
  }

  @Patch('users/:userId/role')
  @ApiOperation({
    summary: 'Cambiar rol de usuario (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para asignar o cambiar el rol global de un usuario dentro de la plataforma.',
  })
  @ApiResponse({ status: 200, description: 'Rol actualizado correctamente.' })
  changeUserRole(@Param('userId') userId: string, @Body() body: ChangeUserRoleDto) {
    return this.platformService.changeUserRole(userId, body);
  }

  @Patch('users/:userId/activate')
  @ApiOperation({
    summary: 'Activar usuario (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para reactivar o habilitar un usuario, permitiendo que pueda operar nuevamente segun su rol.',
  })
  @ApiResponse({ status: 200, description: 'Usuario activado correctamente.' })
  activateUser(@Param('userId') userId: string) {
    return this.platformService.activateUser(userId);
  }

  @Patch('users/:userId/deactivate')
  @ApiOperation({
    summary: 'Desactivar usuario (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para bloquear operativamente un usuario e impedir que siga usando funcionalidades protegidas.',
  })
  @ApiResponse({ status: 200, description: 'Usuario desactivado correctamente.' })
  deactivateUser(@Param('userId') userId: string) {
    return this.platformService.deactivateUser(userId);
  }
}
