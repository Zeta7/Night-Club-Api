import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessageResponseDto } from '../../../shared/presentation/response.dto';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { TicketsService } from '../application/tickets.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { TicketTypeResponseDto, TicketTypesResponseDto } from './tickets.response.dto';

@ApiTags('Club Tickets')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/tickets')
export class ClubTicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear tipo de entrada general de local nocturno (ADMIN, SUPER_ADMIN)',
    description:
      'Crea entradas generales del local nocturno sin asociarlas a un evento específico.',
  })
  @ApiResponse({
    type: TicketTypeResponseDto,
    status: 201,
    description: 'Entrada del local nocturno creada correctamente.',
  })
  createClubTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: CreateTicketTypeDto,
  ): Promise<TicketTypeResponseDto> {
    return this.ticketsService.createClubTicketType(currentUser, clubId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Listar entradas generales de local nocturno (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: TicketTypesResponseDto,
    status: 200,
    description: 'Entradas del local nocturno obtenidas correctamente.',
  })
  listClubTicketTypes(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<TicketTypesResponseDto> {
    return this.ticketsService.listClubTicketTypes(currentUser, clubId);
  }

  @Patch(':ticketTypeId')
  @ApiOperation({ summary: 'Actualizar tipo de entrada (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: TicketTypeResponseDto,
    status: 200,
    description: 'Entrada actualizada correctamente.',
  })
  updateTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('ticketTypeId') ticketTypeId: string,
    @Body() body: UpdateTicketTypeDto,
  ): Promise<TicketTypeResponseDto> {
    return this.ticketsService.updateTicketType(currentUser, clubId, ticketTypeId, body);
  }

  @Patch(':ticketTypeId/deactivate')
  @ApiOperation({ summary: 'Desactivar tipo de entrada (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: TicketTypeResponseDto,
    status: 200,
    description: 'Entrada desactivada correctamente.',
  })
  deactivateTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('ticketTypeId') ticketTypeId: string,
  ): Promise<TicketTypeResponseDto> {
    return this.ticketsService.deactivateTicketType(currentUser, clubId, ticketTypeId);
  }

  @Patch(':ticketTypeId/activate')
  @ApiOperation({ summary: 'Activar tipo de entrada (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: TicketTypeResponseDto,
    status: 200,
    description: 'Entrada activada correctamente.',
  })
  activateTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('ticketTypeId') ticketTypeId: string,
  ): Promise<TicketTypeResponseDto> {
    return this.ticketsService.activateTicketType(currentUser, clubId, ticketTypeId);
  }

  @Delete(':ticketTypeId')
  @ApiOperation({ summary: 'Eliminar tipo de entrada (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({
    type: MessageResponseDto,
    status: 200,
    description: 'Entrada eliminada correctamente.',
  })
  deleteTicketType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('ticketTypeId') ticketTypeId: string,
  ): Promise<MessageResponseDto> {
    return this.ticketsService.deleteTicketType(currentUser, clubId, ticketTypeId);
  }
}
