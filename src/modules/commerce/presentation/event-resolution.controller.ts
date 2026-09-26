import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse } from '@nestjs/swagger';
import { IsDateString, IsIn, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { IsInteger } from '../../../shared/presentation/dto-fields';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { EventRefundWorker } from '../application/event-refund-worker.service';
import { EventReplacementService } from '../application/event-replacement.service';
import {
  AcceptReplacementResponseDto,
  EventRefundJobsResponseDto,
  ReplacementMappingResponseDto,
  ReplacementOptionsResponseDto,
  ReviewRefundJobResponseDto,
  UnallocatedRefundResponseDto,
} from './event-resolution.response.dto';

class ReplacementMappingDto {
  @ApiProperty({ enum: ['TICKET', 'PROMOTION'] })
  @IsIn(['TICKET', 'PROMOTION'])
  itemType!: 'TICKET' | 'PROMOTION';
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sourceItemId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetItemId!: string;
}
class AcceptReplacementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cancellationId!: string;
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startsAt!: string;
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  endsAt!: string;
}
class ReviewJobDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';
  @ApiProperty({ minimum: 1, description: 'Importe exacto a devolver, en céntimos.' })
  @IsInteger()
  @Min(1)
  amountCents!: number;
  @ApiProperty({ minLength: 5, maxLength: 1000 })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

@UseGuards(AccessTokenGuard)
@Controller()
export class EventResolutionController {
  constructor(
    private readonly replacements: EventReplacementService,
    private readonly refunds: EventRefundWorker,
  ) {}
  @ApiOperation({ summary: 'Listar devoluciones de eventos de la plataforma (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: EventRefundJobsResponseDto })
  @Get('events/admin/refund-jobs')
  jobs(@CurrentUser() user: AuthenticatedUser): Promise<EventRefundJobsResponseDto> {
    return this.refunds.list(user);
  }
  @ApiOperation({ summary: 'Listar devoluciones de un evento del club (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: EventRefundJobsResponseDto })
  @Get('clubs/:clubId/events/:eventId/refund-jobs')
  businessJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') club: string,
    @Param('eventId') event: string,
  ): Promise<EventRefundJobsResponseDto> {
    return this.refunds.list(user, club, event);
  }
  @ApiOperation({
    summary: 'Aprobar o rechazar una devolución de evento en revisión (SUPER_ADMIN)',
  })
  @ApiResponse({ status: 201, type: ReviewRefundJobResponseDto })
  @Post('events/admin/refund-jobs/:id/review')
  reviewJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: ReviewJobDto,
  ): Promise<ReviewRefundJobResponseDto> {
    return this.refunds.review(
      user,
      id,
      input.amountCents,
      input.reason,
      input.decision === 'APPROVE',
    );
  }
  @ApiOperation({
    summary: 'Procesar una devolución de evento sin asignación automática (SUPER_ADMIN)',
  })
  @ApiResponse({ status: 201, type: UnallocatedRefundResponseDto })
  @Post('events/admin/unallocated-refunds/:id/process')
  processUnallocated(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: ReviewJobDto,
  ): Promise<UnallocatedRefundResponseDto> {
    if (input.decision !== 'APPROVE')
      throw new BadRequestException('Se requiere aprobación explícita.');
    return this.refunds.processUnallocated(user, id, input.amountCents, input.reason);
  }
  @ApiOperation({
    summary:
      'Consultar entradas y promociones para reemplazar las compras de un evento (ADMIN, SUPER_ADMIN)',
  })
  @ApiResponse({ status: 200, type: ReplacementOptionsResponseDto })
  @Get('clubs/:clubId/events/:eventId/replacement-options')
  options(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') club: string,
    @Param('eventId') event: string,
  ): Promise<ReplacementOptionsResponseDto> {
    return this.replacements.options(user, club, event);
  }
  @ApiOperation({ summary: 'Asignar una entrada o promoción de reemplazo (ADMIN, SUPER_ADMIN)' })
  @ApiResponse({ status: 201, type: ReplacementMappingResponseDto })
  @Post('clubs/:clubId/events/:eventId/replacement-mappings')
  configure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') club: string,
    @Param('eventId') event: string,
    @Body() input: ReplacementMappingDto,
  ): Promise<ReplacementMappingResponseDto> {
    return this.replacements.configure(
      user,
      club,
      event,
      input.itemType,
      input.sourceItemId,
      input.targetItemId,
    );
  }
  @ApiOperation({
    summary: 'Aceptar el reemplazo de mi compra de evento (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
  })
  @ApiResponse({ status: 201, type: AcceptReplacementResponseDto })
  @Post('events/me/purchases/:id/accept-replacement')
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: AcceptReplacementDto,
  ): Promise<AcceptReplacementResponseDto> {
    return this.replacements.accept(user, id, input.cancellationId, input.startsAt, input.endsAt);
  }
}
