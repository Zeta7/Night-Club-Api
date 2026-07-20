import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { ClubWorkersService } from '../application/club-workers.service';
import { RegisterClubWorkerDto } from './dto/register-club-worker.dto';
import { ReplaceClubWorkerPermissionsDto } from './dto/replace-club-worker-permissions.dto';
import { UpdateClubWorkerDto } from './dto/update-club-worker.dto';

@ApiTags('Club Workers')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/workers')
export class ClubWorkersController {
  constructor(private readonly clubWorkersService: ClubWorkersService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar trabajador del club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para vincular un usuario activo como trabajador del club y asignarle permisos operativos.',
  })
  @ApiResponse({ status: 201, description: 'Trabajador registrado correctamente.' })
  registerWorker(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: RegisterClubWorkerDto,
  ) {
    return this.clubWorkersService.registerWorker(currentUser, clubId, body);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar trabajadores del club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para consultar los trabajadores asociados al club, su estado y sus permisos configurados.',
  })
  @ApiResponse({ status: 200, description: 'Trabajadores obtenidos correctamente.' })
  listWorkers(@CurrentUser() currentUser: AuthenticatedUser, @Param('clubId') clubId: string) {
    return this.clubWorkersService.listWorkers(currentUser, clubId);
  }

  @Patch(':workerId')
  @ApiOperation({
    summary: 'Actualizar trabajador del club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para cambiar el estado operativo de un trabajador dentro del club.',
  })
  @ApiResponse({ status: 200, description: 'Trabajador actualizado correctamente.' })
  updateWorker(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('workerId') workerId: string,
    @Body() body: UpdateClubWorkerDto,
  ) {
    return this.clubWorkersService.updateWorker(currentUser, clubId, workerId, body);
  }

  @Put(':workerId/permissions')
  @ApiOperation({
    summary: 'Reemplazar permisos del trabajador (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para reemplazar por completo la lista de permisos que tiene un trabajador dentro del club.',
  })
  @ApiResponse({ status: 200, description: 'Permisos actualizados correctamente.' })
  replacePermissions(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('workerId') workerId: string,
    @Body() body: ReplaceClubWorkerPermissionsDto,
  ) {
    return this.clubWorkersService.replacePermissions(currentUser, clubId, workerId, body);
  }

  @Delete(':workerId')
  @ApiOperation({
    summary: 'Desvincular trabajador del club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para eliminar la relacion operativa entre un trabajador y el club.',
  })
  @ApiResponse({ status: 200, description: 'Trabajador desvinculado correctamente.' })
  removeWorker(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('workerId') workerId: string,
  ) {
    return this.clubWorkersService.removeWorker(currentUser, clubId, workerId);
  }
}
