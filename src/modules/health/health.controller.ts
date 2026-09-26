import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './presentation/health.response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @ApiResponse({ status: 200, type: HealthResponseDto })
  @Get()
  @ApiOperation({
    summary: 'Verificar estado de la API (PUBLIC)',
    description:
      'Acceso: PUBLIC. No requiere token. Permite comprobar la disponibilidad de la API y consultar el estado del servicio.',
  })
  check(): HealthResponseDto {
    return {
      status: 'ok',
      service: 'nightclub-platform-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
