import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../shared/presentation/response.dto';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { ClubWorkersService } from '../application/club-workers.service';
import { RegisterClubWorkerDto } from './dto/register-club-worker.dto';
import { ReplaceClubWorkerPermissionsDto } from './dto/replace-club-worker-permissions.dto';
import { UpdateClubWorkerDto } from './dto/update-club-worker.dto';
import {
  AuthorizeWorkerDeviceDto,
  CloseWorkerShiftDto,
  StartWorkerShiftDto,
  SyncWorkerShiftDto,
} from './dto/worker-operations.dto';
import {
  ClosedWorkerShiftResponseDto,
  ClubWorkerResponseDto,
  ClubWorkersResponseDto,
  RevokedWorkerDeviceResponseDto,
  WorkerDeviceResponseDto,
  WorkerOperationsReportResponseDto,
  WorkerShiftResponseDto,
  WorkerShiftSyncResponseDto,
  WorkerShiftsResponseDto,
} from './worker.response.dto';

@ApiTags('Club Workers')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/workers')
export class ClubWorkersController {
  constructor(private readonly clubWorkersService: ClubWorkersService) {}

  @ApiOperation({
    summary: 'Iniciar mi turno (WORKER)',
    description:
      'Requiere una vinculación activa como trabajador del club y un dispositivo autorizado.',
  })
  @ApiResponse({ status: 201, type: WorkerShiftResponseDto })
  @Post('me/shifts')
  startMyShift(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: StartWorkerShiftDto,
  ): Promise<WorkerShiftResponseDto> {
    return this.clubWorkersService.startShift(currentUser, clubId, body);
  }

  @ApiOperation({
    summary: 'Sincronizar mi turno (WORKER)',
    description:
      'Requiere una vinculación activa como trabajador del club y un turno propio activo.',
  })
  @ApiResponse({ status: 201, type: WorkerShiftSyncResponseDto })
  @Post('me/shifts/:shiftId/sync')
  syncMyShift(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('shiftId') shiftId: string,
    @Body() body: SyncWorkerShiftDto,
  ): Promise<WorkerShiftSyncResponseDto> {
    return this.clubWorkersService.syncShift(currentUser, clubId, shiftId, body);
  }

  @ApiOperation({ summary: 'Listar los turnos de un trabajador (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: WorkerShiftsResponseDto })
  @Get(':workerId/shifts')
  listShifts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('workerId') workerId: string,
  ): Promise<WorkerShiftsResponseDto> {
    return this.clubWorkersService.listShifts(user, clubId, workerId);
  }

  @ApiOperation({ summary: 'Cerrar el turno de un trabajador (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({ status: 201, type: ClosedWorkerShiftResponseDto })
  @Post(':workerId/shifts/:shiftId/close')
  closeShift(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('workerId') workerId: string,
    @Param('shiftId') shiftId: string,
    @Body() body: CloseWorkerShiftDto,
  ): Promise<ClosedWorkerShiftResponseDto> {
    return this.clubWorkersService.closeShift(user, clubId, workerId, shiftId, body.reason);
  }

  @ApiOperation({ summary: 'Autorizar un dispositivo de un trabajador (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({ status: 201, type: WorkerDeviceResponseDto })
  @Post(':workerId/devices')
  authorizeDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('workerId') workerId: string,
    @Body() body: AuthorizeWorkerDeviceDto,
  ): Promise<WorkerDeviceResponseDto> {
    return this.clubWorkersService.authorizeDevice(user, clubId, workerId, body);
  }

  @ApiOperation({ summary: 'Revocar un dispositivo de un trabajador (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: RevokedWorkerDeviceResponseDto })
  @Delete(':workerId/devices/:deviceId')
  revokeDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('workerId') workerId: string,
    @Param('deviceId') deviceId: string,
  ): Promise<RevokedWorkerDeviceResponseDto> {
    return this.clubWorkersService.revokeDevice(user, clubId, workerId, deviceId);
  }

  @ApiOperation({ summary: 'Consultar la actividad de un trabajador (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: WorkerOperationsReportResponseDto })
  @Get(':workerId/report')
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('workerId') workerId: string,
  ): Promise<WorkerOperationsReportResponseDto> {
    return this.clubWorkersService.workerReport(user, clubId, workerId);
  }

  @Post()
  @ApiOperation({
    summary: 'Registrar trabajador del club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para vincular un usuario activo como trabajador del club y asignarle permisos operativos.',
  })
  @ApiResponse({
    type: ClubWorkerResponseDto,
    status: 201,
    description: 'Trabajador registrado correctamente.',
  })
  registerWorker(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: RegisterClubWorkerDto,
  ): Promise<ClubWorkerResponseDto> {
    return this.clubWorkersService.registerWorker(currentUser, clubId, body);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar trabajadores del club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para consultar los trabajadores asociados al club, su estado y sus permisos configurados.',
  })
  @ApiResponse({
    type: ClubWorkersResponseDto,
    status: 200,
    description: 'Trabajadores obtenidos correctamente.',
  })
  listWorkers(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<ClubWorkersResponseDto> {
    return this.clubWorkersService.listWorkers(currentUser, clubId);
  }

  @Patch(':workerId')
  @ApiOperation({
    summary: 'Actualizar trabajador del club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para cambiar el estado operativo de un trabajador dentro del club.',
  })
  @ApiResponse({
    type: ClubWorkerResponseDto,
    status: 200,
    description: 'Trabajador actualizado correctamente.',
  })
  updateWorker(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('workerId') workerId: string,
    @Body() body: UpdateClubWorkerDto,
  ): Promise<ClubWorkerResponseDto> {
    return this.clubWorkersService.updateWorker(currentUser, clubId, workerId, body);
  }

  @Put(':workerId/permissions')
  @ApiOperation({
    summary: 'Reemplazar permisos del trabajador (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para reemplazar por completo la lista de permisos que tiene un trabajador dentro del club.',
  })
  @ApiResponse({
    type: ClubWorkerResponseDto,
    status: 200,
    description: 'Permisos actualizados correctamente.',
  })
  replacePermissions(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('workerId') workerId: string,
    @Body() body: ReplaceClubWorkerPermissionsDto,
  ): Promise<ClubWorkerResponseDto> {
    return this.clubWorkersService.replacePermissions(currentUser, clubId, workerId, body);
  }

  @Delete(':workerId')
  @ApiOperation({
    summary: 'Desvincular trabajador del club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para eliminar la relacion operativa entre un trabajador y el club.',
  })
  @ApiResponse({
    type: MessageResponseDto,
    status: 200,
    description: 'Trabajador desvinculado correctamente.',
  })
  removeWorker(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('workerId') workerId: string,
  ): Promise<MessageResponseDto> {
    return this.clubWorkersService.removeWorker(currentUser, clubId, workerId);
  }
}
