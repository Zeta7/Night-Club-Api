import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { WalletsService } from '../application/wallets.service';
import { WithdrawalsService } from '../application/withdrawals.service';
import {
  ClubLedgerResponseDto,
  LedgerDifferencesResponseDto,
  OrderReconciliationResponseDto,
} from './ledger.response.dto';
import {
  WalletMovementResponseDto,
  WalletOrderDetailResponseDto,
  WalletResponseDto,
  WalletTopUpDetailResponseDto,
} from './wallets.response.dto';
import {
  CreateWithdrawalDto,
  DailyReconciliationQueryDto,
  FailWithdrawalDto,
  ListWithdrawalsDto,
  PayWithdrawalDto,
  ReviewWithdrawalDto,
  UpsertFinancialProfileDto,
} from './withdrawal.dto';
import {
  ClubWithdrawalsResponseDto,
  FinancialProfileResponseDto,
  PlatformWithdrawalsResponseDto,
  WithdrawalResponseDto,
} from './withdrawals.response.dto';

@ApiTags('Wallets')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly withdrawalsService: WithdrawalsService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Obtener la billetera del usuario autenticado',
    description:
      'Devuelve saldo real, total gastado, ultima recarga, movimientos recientes y estadisticas de la billetera.',
  })
  @ApiResponse({
    type: WalletResponseDto,
    status: 200,
    description: 'Billetera obtenida correctamente.',
  })
  getMine(@CurrentUser() currentUser: AuthenticatedUser): Promise<WalletResponseDto> {
    return this.walletsService.getMine(currentUser);
  }

  @ApiResponse({ status: 200, type: WalletMovementResponseDto })
  @Get('me/movements/:id')
  movement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<WalletMovementResponseDto> {
    return this.walletsService.movementDetail(user, id);
  }

  @ApiResponse({ status: 200, type: WalletOrderDetailResponseDto })
  @Get('me/orders/:id')
  orderDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<WalletOrderDetailResponseDto> {
    return this.walletsService.orderDetail(user, id);
  }

  @ApiResponse({ status: 200, type: WalletTopUpDetailResponseDto })
  @Get('me/top-ups/:id')
  topUpDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<WalletTopUpDetailResponseDto> {
    return this.walletsService.topUpDetail(user, id);
  }

  @ApiOperation({ summary: 'Obtener el libro mayor de un local nocturno' })
  @ApiResponse({ status: 200, type: ClubLedgerResponseDto })
  @Get('clubs/:clubId')
  getClubLedger(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<ClubLedgerResponseDto> {
    return this.walletsService.getClubLedger(currentUser, clubId);
  }

  @ApiOperation({ summary: 'Conciliar una orden' })
  @ApiResponse({ status: 200, type: OrderReconciliationResponseDto })
  @Get('reconciliation/orders/:orderId')
  reconcileOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ): Promise<OrderReconciliationResponseDto> {
    return this.walletsService.reconcileOrder(currentUser, orderId);
  }

  @ApiOperation({ summary: 'Obtener las diferencias diarias' })
  @ApiResponse({ status: 200, type: LedgerDifferencesResponseDto })
  @Get('reconciliation/daily')
  dailyDifferences(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: DailyReconciliationQueryDto,
  ): Promise<LedgerDifferencesResponseDto> {
    return this.walletsService.dailyDifferences(currentUser, query.date);
  }

  @ApiOperation({ summary: 'Obtener el perfil financiero de un local nocturno' })
  @ApiExtraModels(FinancialProfileResponseDto)
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      nullable: true,
      allOf: [{ $ref: getSchemaPath(FinancialProfileResponseDto) }],
    },
  })
  @Get('clubs/:clubId/financial-profile')
  financialProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<FinancialProfileResponseDto | null> {
    return this.withdrawalsService.getProfile(user, clubId);
  }

  @ApiOperation({ summary: 'Crear o actualizar el perfil financiero' })
  @ApiResponse({ status: 200, type: FinancialProfileResponseDto })
  @Put('clubs/:clubId/financial-profile')
  upsertFinancialProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: UpsertFinancialProfileDto,
  ): Promise<FinancialProfileResponseDto> {
    return this.withdrawalsService.upsertProfile(user, clubId, body);
  }

  @ApiResponse({ status: 201, type: WithdrawalResponseDto })
  @Post('clubs/:clubId/withdrawals')
  requestWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: CreateWithdrawalDto,
  ): Promise<WithdrawalResponseDto> {
    return this.withdrawalsService.request(user, clubId, body);
  }

  @ApiOperation({ summary: 'Listar retiros de un local nocturno' })
  @ApiResponse({ status: 200, type: ClubWithdrawalsResponseDto })
  @Get('clubs/:clubId/withdrawals')
  clubWithdrawals(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<ClubWithdrawalsResponseDto> {
    return this.withdrawalsService.listClub(user, clubId);
  }

  @ApiOperation({ summary: 'Listar retiros de la plataforma' })
  @ApiResponse({ status: 200, type: PlatformWithdrawalsResponseDto })
  @Get('withdrawals')
  platformWithdrawals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWithdrawalsDto,
  ): Promise<PlatformWithdrawalsResponseDto> {
    return this.withdrawalsService.listPlatform(user, query.status);
  }

  @ApiResponse({ status: 200, type: WithdrawalResponseDto })
  @Patch('withdrawals/:id/review')
  reviewWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ReviewWithdrawalDto,
  ): Promise<WithdrawalResponseDto> {
    return this.withdrawalsService.review(user, id, body.action, body.reason);
  }

  @ApiResponse({ status: 200, type: WithdrawalResponseDto })
  @Patch('withdrawals/:id/processing')
  processWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<WithdrawalResponseDto> {
    return this.withdrawalsService.markProcessing(user, id);
  }

  @ApiOperation({ summary: 'Marcar un retiro como pagado' })
  @ApiResponse({ status: 200, type: WithdrawalResponseDto })
  @Patch('withdrawals/:id/paid')
  payWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: PayWithdrawalDto,
  ): Promise<WithdrawalResponseDto> {
    return this.withdrawalsService.markPaid(user, id, body.paymentReference, body.proofUrl);
  }

  @ApiOperation({ summary: 'Marcar un retiro como fallido' })
  @ApiResponse({ status: 200, type: WithdrawalResponseDto })
  @Patch('withdrawals/:id/failed')
  failWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: FailWithdrawalDto,
  ): Promise<WithdrawalResponseDto> {
    return this.withdrawalsService.markFailed(user, id, body.reason);
  }
}
