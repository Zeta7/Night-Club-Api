import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../shared/presentation/response.dto';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { TicketsService } from '../application/tickets.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { TicketTypeResponseDto, TicketTypesResponseDto } from './tickets.response.dto';

@ApiTags('Event Tickets')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/events/:eventId/tickets')
export class EventTicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear tipo de entrada para evento (ADMIN, SUPER_ADMIN)',
    description:
      'Crea entradas asociadas a un evento especifico. Ejemplo: General, VIP, Early Bird o Box para un evento determinado.',
  })
  @ApiResponse({
    type: TicketTypeResponseDto,
    status: 201,
    description: 'Entrada de evento creada correctamente.',
  })
  createEventTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
    @Body() body: CreateTicketTypeDto,
  ): Promise<TicketTypeResponseDto> {
    return this.ticketsService.createEventTicketType(currentUser, clubId, eventId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Listar entradas de un evento (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: TicketTypesResponseDto,
    status: 200,
    description: 'Entradas de evento obtenidas correctamente.',
  })
  listEventTicketTypes(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
  ): Promise<TicketTypesResponseDto> {
    return this.ticketsService.listEventTicketTypes(currentUser, clubId, eventId);
  }

  @Patch(':ticketTypeId')
  @ApiOperation({ summary: 'Actualizar entrada de un evento (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: TicketTypeResponseDto,
    status: 200,
    description: 'Entrada de evento actualizada correctamente.',
  })
  updateEventTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
    @Param('ticketTypeId') ticketTypeId: string,
    @Body() body: UpdateTicketTypeDto,
  ): Promise<TicketTypeResponseDto> {
    return this.ticketsService.updateEventTicketType(
      currentUser,
      clubId,
      eventId,
      ticketTypeId,
      body,
    );
  }

  @Patch(':ticketTypeId/deactivate')
  @ApiOperation({ summary: 'Desactivar entrada de un evento (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: TicketTypeResponseDto,
    status: 200,
    description: 'Entrada de evento desactivada correctamente.',
  })
  deactivateEventTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
    @Param('ticketTypeId') ticketTypeId: string,
  ): Promise<TicketTypeResponseDto> {
    return this.ticketsService.deactivateEventTicketType(
      currentUser,
      clubId,
      eventId,
      ticketTypeId,
    );
  }

  @Patch(':ticketTypeId/activate')
  @ApiOperation({ summary: 'Activar entrada de un evento (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: TicketTypeResponseDto,
    status: 200,
    description: 'Entrada de evento activada correctamente.',
  })
  activateEventTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
    @Param('ticketTypeId') ticketTypeId: string,
  ): Promise<TicketTypeResponseDto> {
    return this.ticketsService.activateEventTicketType(currentUser, clubId, eventId, ticketTypeId);
  }

  @Delete(':ticketTypeId')
  @ApiOperation({ summary: 'Eliminar entrada de un evento (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: MessageResponseDto,
    status: 200,
    description: 'Entrada de evento eliminada correctamente.',
  })
  deleteEventTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
    @Param('ticketTypeId') ticketTypeId: string,
  ): Promise<MessageResponseDto> {
    return this.ticketsService.deleteEventTicketType(currentUser, clubId, eventId, ticketTypeId);
  }
}
