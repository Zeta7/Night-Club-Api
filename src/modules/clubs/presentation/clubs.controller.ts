import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { ClubsService } from '../application/clubs.service';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';

@ApiTags('Clubs')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Se usa para registrar un nuevo club en la plataforma; el club queda pendiente de aprobacion y el creador se asigna como administrador.',
  })
  @ApiResponse({ status: 201, description: 'Club creado correctamente.' })
  createClub(@CurrentUser() currentUser: AuthenticatedUser, @Body() body: CreateClubDto) {
    return this.clubsService.createClub(currentUser, body);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar clubes visibles segun el rol (CLIENTE, ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: CLIENTE, ADMIN, SUPER_ADMIN. Requiere accessToken. Se usa para obtener el listado de clubes disponibles segun el rol: cliente ve clubes activos, ADMIN ve clubes que administra y SUPER_ADMIN ve todos.',
  })
  @ApiResponse({ status: 200, description: 'Clubes obtenidos correctamente.' })
  listClubs(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.clubsService.listClubs(currentUser);
  }

  @Get('admin/dashboard')
  @ApiOperation({
    summary: 'Obtener dashboard admin del club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Devuelve el estado del dashboard admin; si el usuario admin aun no administra una discoteca, retorna hasClub=false con los datos necesarios para mostrar la pantalla sin datos.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard admin obtenido correctamente.' })
  getAdminDashboard(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.clubsService.getAdminDashboard(currentUser);
  }

  @Get(':clubId')
  @ApiOperation({
    summary: 'Obtener detalle de club (CLIENTE, ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: CLIENTE, ADMIN, SUPER_ADMIN. Requiere accessToken. Se usa para consultar la informacion detallada de un club especifico respetando la visibilidad permitida para cada rol.',
  })
  @ApiResponse({ status: 200, description: 'Club obtenido correctamente.' })
  getClub(@CurrentUser() currentUser: AuthenticatedUser, @Param('clubId') clubId: string) {
    return this.clubsService.getClub(currentUser, clubId);
  }

  @Patch(':clubId')
  @ApiOperation({
    summary: 'Actualizar club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para modificar el perfil estructurado del negocio: nombre, descripcion, tipo, direccion, contacto, redes, horario e imagenes.',
  })
  @ApiResponse({ status: 200, description: 'Club actualizado correctamente.' })
  updateClub(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: UpdateClubDto,
  ) {
    return this.clubsService.updateClub(currentUser, clubId, body);
  }

  @Patch(':clubId/activate')
  @ApiOperation({
    summary: 'Activar club (SUPER_ADMIN)',
    description:
      'Roles permitidos: SUPER_ADMIN. Requiere accessToken. Se usa para habilitar un club aprobado, permitiendo su operacion y visibilidad publica dentro de la plataforma.',
  })
  @ApiResponse({ status: 200, description: 'Club activado correctamente.' })
  activateClub(@CurrentUser() currentUser: AuthenticatedUser, @Param('clubId') clubId: string) {
    return this.clubsService.activateClub(currentUser, clubId);
  }

  @Patch(':clubId/deactivate')
  @ApiOperation({
    summary: 'Desactivar club (SUPER_ADMIN)',
    description:
      'Roles permitidos: SUPER_ADMIN. Requiere accessToken. Se usa para deshabilitar un club e impedir su operacion o exposicion publica dentro de la plataforma.',
  })
  @ApiResponse({ status: 200, description: 'Club desactivado correctamente.' })
  deactivateClub(@CurrentUser() currentUser: AuthenticatedUser, @Param('clubId') clubId: string) {
    return this.clubsService.deactivateClub(currentUser, clubId);
  }
}
