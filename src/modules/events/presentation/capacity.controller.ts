import { Body, Controller, Get, Param, Patch, Post, Sse, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { CapacityService } from '../application/capacity.service';
import { CapacityHistoryResponseDto, CapacityResponseDto } from './capacity.response.dto';
import {
  CorrectCapacityDto,
  RegisterCapacityExitDto,
  UpdateCapacitySettingsDto,
} from './dto/capacity.dto';

@ApiTags('Capacity')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/events/:eventId/capacity')
export class CapacityController {
  constructor(private readonly service: CapacityService) {}
  @ApiOperation({ summary: 'Obtener el aforo actual' })
  @ApiResponse({ status: 200, type: CapacityResponseDto })
  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
  ): Promise<CapacityResponseDto> {
    return this.service.get(user, clubId, eventId);
  }
  @ApiOperation({ summary: 'Transmitir actualizaciones de aforo' })
  @Sse('stream')
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      'Stream SSE que emite eventos capacity.updated cada vez que cambia la revisión del aforo.',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example:
            'event: capacity.updated\ndata: {"current":120,"capacity":300,"available":180,"revision":8}\n\n',
        },
      },
    },
  })
  stream(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.service.stream(user, clubId, eventId);
  }
  @ApiOperation({ summary: 'Listar el historial de aforo' })
  @ApiResponse({ status: 200, type: CapacityHistoryResponseDto })
  @Get('history')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
  ): Promise<CapacityHistoryResponseDto> {
    return this.service.history(user, clubId, eventId);
  }
  @ApiOperation({ summary: 'Configurar el aforo de un local nocturno' })
  @ApiResponse({ status: 200, type: CapacityResponseDto })
  @Patch('settings')
  configure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
    @Body() body: UpdateCapacitySettingsDto,
  ): Promise<CapacityResponseDto> {
    return this.service.configure(user, clubId, eventId, body.reentryAllowed);
  }
  @ApiOperation({ summary: 'Registrar una salida de aforo' })
  @ApiResponse({ status: 201, type: CapacityResponseDto })
  @Post('exits')
  exit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
    @Body() body: RegisterCapacityExitDto,
  ): Promise<CapacityResponseDto> {
    return this.service.registerExit(user, clubId, eventId, body.ticketId, body.idempotencyKey);
  }
  @ApiOperation({ summary: 'Corregir el aforo de un local nocturno' })
  @ApiResponse({ status: 201, type: CapacityResponseDto })
  @Post('corrections')
  correct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('eventId') eventId: string,
    @Body() body: CorrectCapacityDto,
  ): Promise<CapacityResponseDto> {
    return this.service.correct(
      user,
      clubId,
      eventId,
      body.targetCount,
      body.reason,
      body.idempotencyKey,
    );
  }
}
