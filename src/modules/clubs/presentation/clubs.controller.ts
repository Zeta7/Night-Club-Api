import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { ClubsService } from '../application/clubs.service';
import { ClubDashboardResponseDto } from './club-dashboard.response.dto';
import {
  ClubOperationalProfileResponseDto,
  ClubResponseDto,
  ClubsResponseDto,
  UpdateClubOperationalProfileResponseDto,
} from './clubs.response.dto';
import {
  CustomerClubDetailResponseDto,
  CustomerEventDetailResponseDto,
  CustomerExploreResponseDto,
  CustomerHomeResponseDto,
  CustomerNearbyClubsResponseDto,
  CustomerNearbyEventsResponseDto,
  CustomerNearbyPromotionsResponseDto,
} from './customer-discovery.response.dto';
import { CreateClubDto } from './dto/create-club.dto';
import { CustomerExploreQueryDto } from './dto/customer-explore-query.dto';
import { CustomerHomeQueryDto } from './dto/customer-home-query.dto';
import { CustomerNearbyCatalogQueryDto } from './dto/customer-nearby-catalog-query.dto';
import { UpdateClubOperationalProfileDto } from './dto/update-club-operational-profile.dto';
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
  @ApiResponse({ type: ClubResponseDto, status: 201, description: 'Club creado correctamente.' })
  createClub(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreateClubDto,
  ): Promise<ClubResponseDto> {
    return this.clubsService.createClub(currentUser, body);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar clubes visibles según el rol (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
    description:
      'Requiere accessToken. CUSTOMER y WORKER ven clubes activos; ADMIN ve los clubes que administra; SUPER_ADMIN ve todos.',
  })
  @ApiResponse({
    type: ClubsResponseDto,
    status: 200,
    description: 'Clubes obtenidos correctamente.',
  })
  listClubs(@CurrentUser() currentUser: AuthenticatedUser): Promise<ClubsResponseDto> {
    return this.clubsService.listClubs(currentUser);
  }

  @Get('admin/dashboard')
  @ApiOperation({
    summary: 'Consultar el panel operativo del club (WORKER, ADMIN, SUPER_ADMIN)',
    description:
      'Requiere accessToken. Devuelve el panel del club vinculado al usuario. Para WORKER incluye su contexto y permisos operativos.',
  })
  @ApiResponse({
    type: ClubDashboardResponseDto,
    status: 200,
    description: 'Dashboard admin obtenido correctamente.',
  })
  getAdminDashboard(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ClubDashboardResponseDto> {
    return this.clubsService.getAdminDashboard(currentUser);
  }

  @Get('customer/home')
  @ApiOperation({
    summary: 'Consultar el inicio por ubicación (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: CUSTOMER, WORKER, ADMIN, SUPER_ADMIN. Requiere accessToken. Devuelve vistas previas ordenadas de Eventos, Locales y Promociones según distrito o provincia; usa departamento solo si ambos faltan y una consulta sin filtros conserva el alcance nacional. Las causas vacías y los totales se entregan en campos tipados.',
  })
  @ApiResponse({
    type: CustomerHomeResponseDto,
    status: 200,
    description: 'Home del cliente obtenido correctamente.',
  })
  getCustomerHome(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: CustomerHomeQueryDto,
  ): Promise<CustomerHomeResponseDto> {
    return this.clubsService.getCustomerHome(currentUser, query);
  }

  @Get('customer/catalog/events')
  @ApiOperation({
    summary: 'Listar Eventos cercanos (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
    description:
      'Continúa el catálogo de Eventos con el mismo ámbito administrativo y orden de Inicio. Los Eventos pospuestos aparecen al final con estado explícito.',
  })
  @ApiResponse({ type: CustomerNearbyEventsResponseDto, status: 200 })
  getCustomerNearbyEvents(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: CustomerNearbyCatalogQueryDto,
  ): Promise<CustomerNearbyEventsResponseDto> {
    return this.clubsService.getCustomerNearbyCatalog(currentUser, 'events', query);
  }

  @Get('customer/catalog/clubs')
  @ApiOperation({
    summary: 'Listar Locales cercanos (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
    description:
      'Continúa el catálogo de Locales con el mismo ámbito administrativo y orden de Inicio.',
  })
  @ApiResponse({ type: CustomerNearbyClubsResponseDto, status: 200 })
  getCustomerNearbyClubs(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: CustomerNearbyCatalogQueryDto,
  ): Promise<CustomerNearbyClubsResponseDto> {
    return this.clubsService.getCustomerNearbyCatalog(currentUser, 'clubs', query);
  }

  @Get('customer/catalog/promotions')
  @ApiOperation({
    summary: 'Listar Promociones cercanas (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
    description:
      'Continúa el catálogo de Promociones con el mismo ámbito administrativo y orden de Inicio.',
  })
  @ApiResponse({ type: CustomerNearbyPromotionsResponseDto, status: 200 })
  getCustomerNearbyPromotions(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: CustomerNearbyCatalogQueryDto,
  ): Promise<CustomerNearbyPromotionsResponseDto> {
    return this.clubsService.getCustomerNearbyCatalog(currentUser, 'promotions', query);
  }

  @Get('customer/explore')
  @ApiOperation({
    summary:
      'Explorar clubes, eventos, promociones y productos en Perú (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
    description:
      'Sin q muestra el catálogo nacional paginado; con q busca por negocio, ciudad, evento, promoción o producto. Solo devuelve negocios activos y contenido visible vigente.',
  })
  @ApiResponse({
    type: CustomerExploreResponseDto,
    status: 200,
    description: 'Resultados nacionales obtenidos correctamente.',
  })
  exploreCustomerContent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: CustomerExploreQueryDto,
  ): Promise<CustomerExploreResponseDto> {
    return this.clubsService.exploreCustomerContent(currentUser, query);
  }

  @Get('customer/clubs/:clubId')
  @ApiOperation({
    summary:
      'Consultar el detalle y catálogo visible de un club (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
    description:
      'Devuelve el negocio activo y todo su contenido visible sin restringirlo a la ubicacion actual del cliente.',
  })
  @ApiResponse({
    type: CustomerClubDetailResponseDto,
    status: 200,
    description: 'Detalle del club obtenido correctamente.',
  })
  getCustomerClubDetail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<CustomerClubDetailResponseDto> {
    return this.clubsService.getCustomerClubDetail(currentUser, clubId);
  }

  @Get('customer/events/:eventId')
  @ApiOperation({
    summary:
      'Consultar el detalle y catálogo visible de un evento (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
  })
  @ApiResponse({
    type: CustomerEventDetailResponseDto,
    status: 200,
    description: 'Detalle del evento obtenido correctamente.',
  })
  getCustomerEventDetail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('eventId') eventId: string,
  ): Promise<CustomerEventDetailResponseDto> {
    return this.clubsService.getCustomerEventDetail(currentUser, eventId);
  }

  @Get(':clubId')
  @ApiOperation({
    summary: 'Obtener detalle de club (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
    description:
      'Requiere accessToken. CUSTOMER y WORKER pueden consultar clubes activos; ADMIN, los clubes que administra; SUPER_ADMIN, cualquier club.',
  })
  @ApiResponse({ type: ClubResponseDto, status: 200, description: 'Club obtenido correctamente.' })
  getClub(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<ClubResponseDto> {
    return this.clubsService.getClub(currentUser, clubId);
  }

  @Patch(':clubId')
  @ApiOperation({
    summary: 'Actualizar club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para modificar el perfil estructurado del negocio: nombre, descripcion, tipo, direccion, contacto, redes, horario e imagenes.',
  })
  @ApiResponse({
    type: ClubResponseDto,
    status: 200,
    description: 'Club actualizado correctamente.',
  })
  updateClub(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: UpdateClubDto,
  ): Promise<ClubResponseDto> {
    return this.clubsService.updateClub(currentUser, clubId, body);
  }

  @ApiOperation({
    summary: 'Obtener el perfil operativo de un local nocturno (ADMIN, SUPER_ADMIN)',
  })
  @ApiResponse({ status: 200, type: ClubOperationalProfileResponseDto })
  @Get(':clubId/operational-profile')
  getOperationalProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<ClubOperationalProfileResponseDto> {
    return this.clubsService.getOperationalProfile(currentUser, clubId);
  }

  @ApiOperation({
    summary: 'Actualizar el perfil operativo de un local nocturno (ADMIN, SUPER_ADMIN)',
  })
  @ApiResponse({ status: 200, type: UpdateClubOperationalProfileResponseDto })
  @Patch(':clubId/operational-profile')
  updateOperationalProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: UpdateClubOperationalProfileDto,
  ): Promise<UpdateClubOperationalProfileResponseDto> {
    return this.clubsService.updateOperationalProfile(currentUser, clubId, body);
  }

  @Patch(':clubId/activate')
  @ApiOperation({
    summary: 'Activar club (SUPER_ADMIN)',
    description:
      'Roles permitidos: SUPER_ADMIN. Requiere accessToken. Se usa para habilitar un club aprobado, permitiendo su operacion y visibilidad publica dentro de la plataforma.',
  })
  @ApiResponse({ type: ClubResponseDto, status: 200, description: 'Club activado correctamente.' })
  activateClub(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<ClubResponseDto> {
    return this.clubsService.activateClub(currentUser, clubId);
  }

  @Patch(':clubId/deactivate')
  @ApiOperation({
    summary: 'Desactivar club (SUPER_ADMIN)',
    description:
      'Roles permitidos: SUPER_ADMIN. Requiere accessToken. Se usa para deshabilitar un club e impedir su operacion o exposicion publica dentro de la plataforma.',
  })
  @ApiResponse({
    type: ClubResponseDto,
    status: 200,
    description: 'Club desactivado correctamente.',
  })
  deactivateClub(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<ClubResponseDto> {
    return this.clubsService.deactivateClub(currentUser, clubId);
  }
}
