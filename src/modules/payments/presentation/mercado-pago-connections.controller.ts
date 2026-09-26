import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { SellerConnectionService } from '../application/seller-connection.service';
import {
  SellerConnectionAuthorizationResponseDto,
  SellerConnectionResponseDto,
  WalletAcceptanceResponseDto,
} from './payments.response.dto';
import { WalletAcceptanceDto } from './wallet-acceptance.dto';

@ApiTags('Mercado Pago connections')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/payments/mercado-pago')
export class MercadoPagoConnectionsController {
  constructor(private readonly connections: SellerConnectionService) {}

  @ApiOperation({
    summary:
      'Consultar si un club acepta pagos con billetera (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
  })
  @ApiResponse({ status: 200, type: WalletAcceptanceResponseDto })
  @Get('wallet-acceptance')
  walletAcceptance(@Param('clubId') clubId: string): Promise<WalletAcceptanceResponseDto> {
    return this.connections.walletAcceptance(clubId);
  }

  @ApiOperation({
    summary: 'Configurar la aceptación de pagos con billetera del club (ADMIN, SUPER_ADMIN)',
  })
  @ApiResponse({ status: 201, type: WalletAcceptanceResponseDto })
  @Post('wallet-acceptance')
  setWalletAcceptance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() input: WalletAcceptanceDto,
  ): Promise<WalletAcceptanceResponseDto> {
    return this.connections.setWalletAcceptance(user, clubId, input.enabled);
  }

  @ApiResponse({ status: 200, type: SellerConnectionResponseDto })
  @Get()
  @ApiOperation({ summary: 'Consultar estado de conexión Mercado Pago (ADMIN, SUPER_ADMIN)' })
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<SellerConnectionResponseDto> {
    return this.connections.status(user, clubId);
  }

  @ApiResponse({ status: 201, type: SellerConnectionAuthorizationResponseDto })
  @Post('connect')
  @ApiOperation({
    summary: 'Crear URL OAuth de un solo uso para Mercado Pago (ADMIN, SUPER_ADMIN)',
  })
  connect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<SellerConnectionAuthorizationResponseDto> {
    return this.connections.start(user, clubId);
  }

  @ApiResponse({ status: 201, type: SellerConnectionResponseDto })
  @Post('disconnect')
  @ApiOperation({ summary: 'Desconectar Mercado Pago del negocio (ADMIN, SUPER_ADMIN)' })
  disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<SellerConnectionResponseDto> {
    return this.connections.disconnect(user, clubId);
  }
}

@Controller('payments/mercado-pago')
export class MercadoPagoOAuthCallbackController {
  constructor(
    private readonly connections: SellerConnectionService,
    private readonly config: ConfigService,
  ) {}

  @Get(['connect', 'oauth/callback'])
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
