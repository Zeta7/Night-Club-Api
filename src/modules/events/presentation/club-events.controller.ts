import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { EventsService } from '../application/events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@ApiTags('Club Events')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/events')
export class ClubEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear evento del club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para crear un nuevo evento dentro del club; el evento inicia en estado DRAFT.',
  })
  @ApiResponse({ status: 201, description: 'Evento creado correctamente.' })
  createEvent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: CreateEventDto,
  ) {
    return this.eventsService.createEvent(currentUser, clubId, body);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar eventos del club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para consultar todos los eventos registrados para un club administrado, sin limitarse a los visibles publicamente.',
  })
  @ApiResponse({ status: 200, description: 'Eventos del club obtenidos correctamente.' })
  listClubEvents(@CurrentUser() currentUser: AuthenticatedUser, @Param('clubId') clubId: string) {
    return this.eventsService.listClubEvents(currentUser, clubId);
  }

  @Patch(':eventId')
  @ApiOperation({
    summary: 'Actualizar evento del club (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para modificar datos del evento como nombre, descripcion, imagen, fechas y aforo.',
  })
  @ApiResponse({ status: 200, description: 'Evento actualizado correctamente.' })
  updateEvent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
    @Body() body: UpdateEventDto,
  ) {
    return this.eventsService.updateEvent(currentUser, clubId, eventId, body);
  }

  @Patch(':eventId/publish')
  @ApiOperation({
    summary: 'Publicar evento (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para publicar un evento preparado y cambiar su estado a PUBLISHED.',
  })
  @ApiResponse({ status: 200, description: 'Evento publicado correctamente.' })
  publishEvent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.publishEvent(currentUser, clubId, eventId);
  }

  @Patch(':eventId/start-sale')
  @ApiOperation({
    summary: 'Activar venta del evento (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para iniciar la venta de entradas o consumibles del evento cambiando su estado a SALE_ACTIVE.',
  })
  @ApiResponse({ status: 200, description: 'Venta activada correctamente.' })
  startSale(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.startSale(currentUser, clubId, eventId);
  }

  @Patch(':eventId/cancel')
  @ApiOperation({
    summary: 'Cancelar evento (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para cancelar un evento activo o planificado y detener su operacion comercial.',
  })
  @ApiResponse({ status: 200, description: 'Evento cancelado correctamente.' })
  cancelEvent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.cancelEvent(currentUser, clubId, eventId);
  }

  @Patch(':eventId/reactivate')
  @ApiOperation({
    summary: 'Reactivar evento (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para reactivar un evento cancelado y volverlo al estado PUBLISHED para que pueda mostrarse nuevamente.',
  })
  @ApiResponse({ status: 200, description: 'Evento reactivado correctamente.' })
  reactivateEvent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.reactivateEvent(currentUser, clubId, eventId);
  }

  @Patch(':eventId/finish')
  @ApiOperation({
    summary: 'Finalizar evento (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Regla: ADMIN solo puede operar clubes que administra. Se usa para marcar un evento como finalizado cuando su operacion ya termino.',
  })
  @ApiResponse({ status: 200, description: 'Evento finalizado correctamente.' })
  finishEvent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.finishEvent(currentUser, clubId, eventId);
  }
}
