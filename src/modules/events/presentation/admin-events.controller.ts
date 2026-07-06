import { Controller, Get, UseGuards } from '@nestjs/common';
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
