import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Verificar estado de la API (PUBLICO)',
    description:
      'Acceso: PUBLICO. No requiere token. Se usa para comprobar que la API esta disponible y devuelve informacion basica de estado del servicio.',
  })
  check() {
    return {
      status: 'ok',
      service: 'nightclub-platform-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
