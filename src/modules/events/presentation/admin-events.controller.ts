import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReviewEventCancellationDto } from './dto/cancel-event.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { EventsService } from '../application/events.service';

@ApiTags('Admin Events')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('events/admin')
export class AdminEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('buyer-refunds')
  buyerRefunds(@CurrentUser() user: AuthenticatedUser) { return this.eventsService.listBuyerRefunds(user); }

  @Post('buyer-refunds/:id/review')
  reviewBuyerRefund(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: ReviewEventCancellationDto) {
    return this.eventsService.reviewBuyerRefund(user, id, input);
  }

  @Get('cancellations')
  cancellations(@CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.listCancellationRequests(user);
  }

  @Post('cancellations/:id/review')
  reviewCancellation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: ReviewEventCancellationDto) {
    return this.eventsService.reviewCancellation(user, id, input);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Obtener dashboard admin de eventos (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Devuelve metricas, alertas, listado y ranking de eventos para el club administrado.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard de eventos obtenido correctamente.' })
  getAdminEventsDashboard(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.eventsService.getAdminEventsDashboard(currentUser);
  }
}
