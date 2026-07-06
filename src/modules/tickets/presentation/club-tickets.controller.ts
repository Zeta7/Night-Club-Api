import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { TicketsService } from '../application/tickets.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';

@ApiTags('Club Tickets')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/tickets')
export class ClubTicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear tipo de entrada general de discoteca (ADMIN, SUPER_ADMIN)',
    description:
      'Crea entradas que pertenecen directamente al club/discoteca y no a un evento especifico. Ejemplo: cover general, entrada de noche regular o acceso libre por dia.',
  })
  @ApiResponse({ status: 201, description: 'Entrada de discoteca creada correctamente.' })
  createClubTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: CreateTicketTypeDto,
  ) {
    return this.ticketsService.createClubTicketType(currentUser, clubId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Listar entradas generales de discoteca (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Entradas de discoteca obtenidas correctamente.' })
  listClubTicketTypes(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ) {
    return this.ticketsService.listClubTicketTypes(currentUser, clubId);
  }

  @Patch(':ticketTypeId')
  @ApiOperation({ summary: 'Actualizar tipo de entrada (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Entrada actualizada correctamente.' })
  updateTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('ticketTypeId') ticketTypeId: string,
    @Body() body: UpdateTicketTypeDto,
  ) {
    return this.ticketsService.updateTicketType(currentUser, clubId, ticketTypeId, body);
  }

  @Patch(':ticketTypeId/deactivate')
  @ApiOperation({ summary: 'Desactivar tipo de entrada (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Entrada desactivada correctamente.' })
  deactivateTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('ticketTypeId') ticketTypeId: string,
  ) {
    return this.ticketsService.deactivateTicketType(currentUser, clubId, ticketTypeId);
  }
}
