import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { EventsService } from '../application/events.service';
import {
  AdminEventCancellationsResponseDto,
  BuyerRefundRequestResponseDto,
  BuyerRefundsResponseDto,
  CancellationRefundResponseDto,
} from './cancellation.response.dto';
import { EventsDashboardResponseDto } from './dashboard.response.dto';
import { ReviewEventCancellationDto } from './dto/cancel-event.dto';

@ApiTags('Admin Events')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('events/admin')
export class AdminEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @ApiResponse({ status: 200, type: BuyerRefundsResponseDto })
  @Get('buyer-refunds')
  buyerRefunds(@CurrentUser() user: AuthenticatedUser): Promise<BuyerRefundsResponseDto> {
    return this.eventsService.listBuyerRefunds(user);
  }

  @ApiResponse({ status: 201, type: BuyerRefundRequestResponseDto })
  @Post('buyer-refunds/:id/review')
  reviewBuyerRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: ReviewEventCancellationDto,
  ): Promise<BuyerRefundRequestResponseDto> {
    return this.eventsService.reviewBuyerRefund(user, id, input);
  }

  @ApiResponse({ status: 200, type: AdminEventCancellationsResponseDto })
  @Get('cancellations')
  cancellations(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminEventCancellationsResponseDto> {
    return this.eventsService.listCancellationRequests(user);
  }

  @ApiResponse({ status: 201, type: CancellationRefundResponseDto })
  @Post('cancellations/:id/review')
  reviewCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: ReviewEventCancellationDto,
  ): Promise<CancellationRefundResponseDto> {
    return this.eventsService.reviewCancellation(user, id, input);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Obtener dashboard admin de eventos (ADMIN, SUPER_ADMIN)',
    description:
      'Roles permitidos: ADMIN, SUPER_ADMIN. Requiere accessToken. Devuelve metricas, alertas, listado y ranking de eventos para el club administrado.',
  })
  @ApiResponse({
    type: EventsDashboardResponseDto,
    status: 200,
    description: 'Dashboard de eventos obtenido correctamente.',
  })
  getAdminEventsDashboard(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<EventsDashboardResponseDto> {
    return this.eventsService.getAdminEventsDashboard(currentUser);
  }
}
