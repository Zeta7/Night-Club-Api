import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './presentation/health.response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @ApiResponse({ status: 200, type: HealthResponseDto })
  @Get()
  @ApiOperation({
    summary: 'Verificar estado de la API (PUBLICO)',
    description:
      'Acceso: PUBLICO. No requiere token. Se usa para comprobar que la API esta disponible y devuelve informacion basica de estado del servicio.',
  })
  check(): HealthResponseDto {
    return {
      status: 'ok',
      service: 'nightclub-platform-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
