import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { ClubsService } from '../application/clubs.service';
import { CreateClubDto } from './dto/create-club.dto';
import { CustomerHomeQueryDto } from './dto/customer-home-query.dto';
import { CustomerExploreQueryDto } from './dto/customer-explore-query.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { UpdateClubOperationalProfileDto } from './dto/update-club-operational-profile.dto';

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
    summary: 'Obtener dashboard admin del club (ADMIN, SUPER_ADMIN, WORKER)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN, WORKER. Requiere accessToken. Devuelve el estado del dashboard operativo del club; si el usuario es WORKER tambien incluye su contexto de permisos para que mobile pueda mostrar solo los modulos habilitados.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard admin obtenido correctamente.' })
  getAdminDashboard(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.clubsService.getAdminDashboard(currentUser);
  }

  @Get('customer/home')
  @ApiOperation({
    summary: 'Obtener home del cliente por ubicacion (AUTENTICADO)',
    description:
      'Roles permitidos: CUSTOMER, WORKER, ADMIN, SUPER_ADMIN. Requiere accessToken. Devuelve el contenido del inicio del cliente filtrado por la ciudad/zona enviada desde mobile y solo considera locales nocturnos activos con eventos, promociones y productos visibles.',
  })
  @ApiResponse({ status: 200, description: 'Home del cliente obtenido correctamente.' })
  getCustomerHome(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: CustomerHomeQueryDto,
  ) {
    return this.clubsService.getCustomerHome(currentUser, query);
  }

  @Get('customer/explore')
  @ApiOperation({
    summary: 'Buscar contenido del cliente en todo Perú (AUTENTICADO)',
    description:
      'Busca nacionalmente por nombre de negocio, ciudad, evento, promoción o producto. Solo devuelve negocios activos y contenido visible vigente.',
  })
  @ApiResponse({ status: 200, description: 'Resultados nacionales obtenidos correctamente.' })
  exploreCustomerContent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: CustomerExploreQueryDto,
  ) {
    return this.clubsService.exploreCustomerContent(currentUser, query);
  }

  @Get('customer/clubs/:clubId')
  @ApiOperation({
    summary: 'Obtener el detalle publico de un club (AUTENTICADO)',
    description:
      'Devuelve el negocio activo y todo su contenido visible sin restringirlo a la ubicacion actual del cliente.',
  })
  @ApiResponse({ status: 200, description: 'Detalle del club obtenido correctamente.' })
  getCustomerClubDetail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ) {
    return this.clubsService.getCustomerClubDetail(currentUser, clubId);
  }

  @Get('customer/events/:eventId')
  @ApiOperation({ summary: 'Obtener el detalle publico de un evento (AUTENTICADO)' })
  @ApiResponse({ status: 200, description: 'Detalle del evento obtenido correctamente.' })
  getCustomerEventDetail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('eventId') eventId: string,
  ) {
    return this.clubsService.getCustomerEventDetail(currentUser, eventId);
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

  @Get(':clubId/operational-profile')
  getOperationalProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ) {
    return this.clubsService.getOperationalProfile(currentUser, clubId);
  }

  @Patch(':clubId/operational-profile')
  updateOperationalProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: UpdateClubOperationalProfileDto,
  ) {
    return this.clubsService.updateOperationalProfile(currentUser, clubId, body);
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
