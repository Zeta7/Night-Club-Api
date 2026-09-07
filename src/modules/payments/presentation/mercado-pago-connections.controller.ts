import { Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SellerConnectionService } from '../application/seller-connection.service';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { ConfigService } from '@nestjs/config';

@ApiTags('Mercado Pago connections')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/payments/mercado-pago')
export class MercadoPagoConnectionsController {
  constructor(private readonly connections: SellerConnectionService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar estado de conexión Mercado Pago' })
  status(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string) {
    return this.connections.status(user, clubId);
  }

  @Post('connect')
  @ApiOperation({ summary: 'Crear URL OAuth de un solo uso para Mercado Pago' })
  connect(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string) {
    return this.connections.start(user, clubId);
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'Desconectar Mercado Pago del negocio' })
  disconnect(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string) {
    return this.connections.disconnect(user, clubId);
  }
}

@Controller('payments/mercado-pago')
export class MercadoPagoOAuthCallbackController {
  constructor(
    private readonly connections: SellerConnectionService,
    private readonly config: ConfigService,
  ) {}

  @Get('oauth/callback')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async callback(@Query('state') state: string, @Query('code') code: string) {
    const result = await this.connections.callback(state, code);
    const scheme = this.config
      .get<string>('MOBILE_APP_SCHEME', 'beerry')
      .replace(/[^a-zA-Z0-9+.-]/g, '');
    const deepLink = `${scheme}://payments/result?provider=mercado_pago&operationType=seller_connection&operationId=${encodeURIComponent(result.clubId)}`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${deepLink}"><title>Mercado Pago conectado</title></head><body><p>Mercado Pago fue conectado. Puedes volver a Beerry.</p><a href="${deepLink}">Volver a Beerry</a></body></html>`;
  }
}
