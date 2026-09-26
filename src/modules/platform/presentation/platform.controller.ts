import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { MarketplaceFeeService } from '../application/marketplace-fee.service';
import { PlatformService } from '../application/platform.service';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { ListPlatformUsersDto } from './dto/list-platform-users.dto';
import {
  RemoveMarketplaceFeeOverrideDto,
  UpdateMarketplaceFeeDto,
} from './dto/marketplace-fee.dto';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { SuperAdminGuard } from './guards/super-admin.guard';
import {
  ClubMarketplaceFeeResponseDto,
  MarketplaceFeeResponseDto,
  PlatformDashboardResponseDto,
  PlatformSettingsResponseDto,
  PlatformUserResponseDto,
  PlatformUsersResponseDto,
} from './platform.response.dto';

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, SuperAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly fees: MarketplaceFeeService,
  ) {}

  @ApiResponse({ status: 200, type: MarketplaceFeeResponseDto })
  @Get('marketplace-fee')
  @ApiOperation({ summary: 'Consultar la comisión global del marketplace (SUPER_ADMIN)' })
  getMarketplaceFee(): Promise<MarketplaceFeeResponseDto> {
    return this.fees.readGlobal();
  }

  @ApiResponse({ status: 200, type: MarketplaceFeeResponseDto })
  @Patch('marketplace-fee')
  @ApiOperation({ summary: 'Modificar la comisión global del marketplace (SUPER_ADMIN)' })
  updateMarketplaceFee(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateMarketplaceFeeDto,
  ): Promise<MarketplaceFeeResponseDto> {
    return this.fees.updateGlobal(user, body.feeBps, body.reason);
  }

  @ApiResponse({ status: 200, type: ClubMarketplaceFeeResponseDto })
  @Patch('clubs/:clubId/marketplace-fee')
  @ApiOperation({ summary: 'Asignar comisión personalizada a un negocio (SUPER_ADMIN)' })
  setClubMarketplaceFee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: UpdateMarketplaceFeeDto,
  ): Promise<ClubMarketplaceFeeResponseDto> {
    return this.fees.setOverride(user, clubId, body.feeBps, body.reason);
  }

  @ApiResponse({ status: 200, type: ClubMarketplaceFeeResponseDto })
  @Delete('clubs/:clubId/marketplace-fee')
  @ApiOperation({
    summary: 'Eliminar excepción y volver a heredar la comisión global (SUPER_ADMIN)',
  })
  removeClubMarketplaceFee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: RemoveMarketplaceFeeOverrideDto,
  ): Promise<ClubMarketplaceFeeResponseDto> {
    return this.fees.removeOverride(user, clubId, body.reason);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Consultar el panel global de la plataforma (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para consultar el panel global de administracion con metricas generales de usuarios, clubes y configuracion de la plataforma.',
  })
  @ApiResponse({
    type: PlatformDashboardResponseDto,
    status: 200,
    description: 'Dashboard global obtenido correctamente.',
  })
  getDashboard(): Promise<PlatformDashboardResponseDto> {
    return this.platformService.getDashboard();
  }

  @ApiResponse({ status: 200, type: PlatformSettingsResponseDto })
  @Get('settings')
  @ApiOperation({ summary: 'Consultar la configuración global (SUPER_ADMIN)' })
  async getSettings(): Promise<PlatformSettingsResponseDto> {
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
  @ApiResponse({
    type: PlatformUsersResponseDto,
    status: 200,
    description: 'Usuarios de plataforma obtenidos correctamente.',
  })
  listUsers(@Query() query: ListPlatformUsersDto): Promise<PlatformUsersResponseDto> {
    return this.platformService.listUsers(query);
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Actualizar la configuración global de la plataforma (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para modificar parametros globales que afectan el comportamiento general de la plataforma.',
  })
  @ApiResponse({
    type: PlatformSettingsResponseDto,
    status: 200,
    description: 'Configuracion actualizada correctamente.',
  })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdatePlatformSettingsDto,
  ): Promise<PlatformSettingsResponseDto> {
    return this.platformService.updateSettings(user, body);
  }

  @Patch('users/:userId/role')
  @ApiOperation({
    summary: 'Cambiar rol de usuario (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para asignar o cambiar el rol global de un usuario dentro de la plataforma.',
  })
  @ApiResponse({
    type: PlatformUserResponseDto,
    status: 200,
    description: 'Rol actualizado correctamente.',
  })
  changeUserRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: ChangeUserRoleDto,
  ): Promise<PlatformUserResponseDto> {
    return this.platformService.changeUserRole(user, userId, body);
  }

  @Patch('users/:userId/status')
  @ApiOperation({
    summary: 'Cambiar estado de cualquier usuario (SUPER_ADMIN)',
    description: 'Permite asignar ACTIVE, INACTIVE o BLOCKED a cualquier cuenta de la plataforma.',
  })
  @ApiResponse({
    type: PlatformUserResponseDto,
    status: 200,
    description: 'Estado de usuario actualizado correctamente.',
  })
  changeUserStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: ChangeUserStatusDto,
  ): Promise<PlatformUserResponseDto> {
    return this.platformService.changeUserStatus(user, userId, body);
  }

  @Patch('users/:userId/activate')
  @ApiOperation({
    summary: 'Activar usuario (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para reactivar o habilitar un usuario, permitiendo que pueda operar nuevamente segun su rol.',
  })
  @ApiResponse({
    type: PlatformUserResponseDto,
    status: 200,
    description: 'Usuario activado correctamente.',
  })
  activateUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ): Promise<PlatformUserResponseDto> {
    return this.platformService.activateUser(user, userId);
  }

  @Patch('users/:userId/deactivate')
  @ApiOperation({
    summary: 'Desactivar usuario (SUPER_ADMIN)',
    description:
      'Usado por: Super Admin. Requiere accessToken. Se usa para bloquear operativamente un usuario e impedir que siga usando funcionalidades protegidas.',
  })
  @ApiResponse({
    type: PlatformUserResponseDto,
    status: 200,
    description: 'Usuario desactivado correctamente.',
  })
  deactivateUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ): Promise<PlatformUserResponseDto> {
    return this.platformService.deactivateUser(user, userId);
  }

  @Patch('users/:userId/block')
  @ApiOperation({
    summary: 'Bloquear cualquier usuario (SUPER_ADMIN)',
    description: 'Bloquea una cuenta CUSTOMER, WORKER, ADMIN o SUPER_ADMIN.',
  })
  @ApiResponse({
    type: PlatformUserResponseDto,
    status: 200,
    description: 'Usuario bloqueado correctamente.',
  })
  blockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ): Promise<PlatformUserResponseDto> {
    return this.platformService.blockUser(user, userId);
  }
}
