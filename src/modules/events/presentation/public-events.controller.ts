import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventsService } from '../application/events.service';
import { EventResponseDto, EventsResponseDto } from './events.response.dto';

@ApiTags('Events')
@Controller('events')
export class PublicEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar eventos públicos (PUBLIC)',
    description:
      'Acceso: PUBLIC. No requiere token. Devuelve eventos publicados y visibles de clubes activos.',
  })
  @ApiResponse({
    type: EventsResponseDto,
    status: 200,
    description: 'Eventos publicos obtenidos correctamente.',
  })
  listPublicEvents(): Promise<EventsResponseDto> {
    return this.eventsService.listPublicEvents();
  }

  @Get(':eventId')
  @ApiOperation({
    summary: 'Consultar el detalle público de un evento (PUBLIC)',
    description:
      'Acceso: PUBLIC. No requiere token. Devuelve el detalle de un evento visible para consultarlo antes de comprar o asistir.',
  })
  @ApiResponse({
    type: EventResponseDto,
    status: 200,
    description: 'Evento obtenido correctamente.',
  })
  getPublicEvent(@Param('eventId') eventId: string): Promise<EventResponseDto> {
    return this.eventsService.getPublicEvent(eventId);
  }
}
