import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { PlatformService } from '../application/platform.service';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { ListPlatformUsersDto } from './dto/list-platform-users.dto';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { MarketplaceFeeService } from '../application/marketplace-fee.service';
import { RemoveMarketplaceFeeOverrideDto, UpdateMarketplaceFeeDto } from './dto/marketplace-fee.dto';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, SuperAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService, private readonly fees: MarketplaceFeeService) {}

  @Get('marketplace-fee')
  @ApiOperation({ summary: 'Consultar la comisión global del marketplace (SUPER_ADMIN)' })
  getMarketplaceFee() { return this.fees.readGlobal(); }

  @Patch('marketplace-fee')
  @ApiOperation({ summary: 'Modificar la comisión global del marketplace (SUPER_ADMIN)' })
  updateMarketplaceFee(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateMarketplaceFeeDto) { return this.fees.updateGlobal(user, body.feeBps, body.reason); }

  @Patch('clubs/:clubId/marketplace-fee')
  @ApiOperation({ summary: 'Asignar comisión personalizada a un negocio (SUPER_ADMIN)' })
  setClubMarketplaceFee(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string, @Body() body: UpdateMarketplaceFeeDto) { return this.fees.setOverride(user, clubId, body.feeBps, body.reason); }

  @Delete('clubs/:clubId/marketplace-fee')
  @ApiOperation({ summary: 'Eliminar excepción y volver a heredar la comisión global (SUPER_ADMIN)' })
  removeClubMarketplaceFee(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string, @Body() body: RemoveMarketplaceFeeOverrideDto) { return this.fees.removeOverride(user, clubId, body.reason); }

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

  @Get('settings')
  @ApiOperation({ summary: 'Consultar la configuración global (SUPER_ADMIN)' })
  async getSettings() {
    return {
      message: 'Configuración global obtenida correctamente.',
      settings: await this.platformService.getSettings(),
    };
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
