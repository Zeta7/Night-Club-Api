import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventsService } from '../application/events.service';

@ApiTags('Events')
@Controller('events')
export class PublicEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar eventos publicos (PUBLICO)',
    description:
      'Acceso: PUBLICO. No requiere token. Se usa para mostrar a clientes y visitantes los eventos publicados y visibles de clubes activos.',
  })
  @ApiResponse({ status: 200, description: 'Eventos publicos obtenidos correctamente.' })
  listPublicEvents() {
    return this.eventsService.listPublicEvents();
  }

  @Get(':eventId')
  @ApiOperation({
    summary: 'Obtener detalle publico de evento (PUBLICO)',
    description:
      'Acceso: PUBLICO. No requiere token. Se usa para consultar el detalle publico de un evento visible, incluyendo la informacion necesaria para explorarlo antes de comprar o asistir.',
  })
  @ApiResponse({ status: 200, description: 'Evento obtenido correctamente.' })
  getPublicEvent(@Param('eventId') eventId: string) {
    return this.eventsService.getPublicEvent(eventId);
  }
}
