import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { WalletsService } from '../application/wallets.service';
import { WithdrawalsService } from '../application/withdrawals.service';
import { CreateWithdrawalDto, FailWithdrawalDto, PayWithdrawalDto, ReviewWithdrawalDto, UpsertFinancialProfileDto } from './withdrawal.dto';

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
  @ApiResponse({ status: 200, description: 'Billetera obtenida correctamente.' })
  getMine(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.walletsService.getMine(currentUser);
  }

  @Get('clubs/:clubId')
  getClubLedger(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ) {
    return this.walletsService.getClubLedger(currentUser, clubId);
  }

  @Get('reconciliation/orders/:orderId')
  reconcileOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    return this.walletsService.reconcileOrder(currentUser, orderId);
  }

  @Get('reconciliation/daily')
  dailyDifferences(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('date') date?: string,
  ) {
    return this.walletsService.dailyDifferences(currentUser, date);
  }

  @Get('clubs/:clubId/financial-profile')
  financialProfile(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string) {
    return this.withdrawalsService.getProfile(user, clubId);
  }

  @Put('clubs/:clubId/financial-profile')
  upsertFinancialProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: UpsertFinancialProfileDto,
  ) {
    return this.withdrawalsService.upsertProfile(user, clubId, body);
  }

  @Post('clubs/:clubId/withdrawals')
  requestWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: CreateWithdrawalDto,
  ) {
    return this.withdrawalsService.request(user, clubId, body);
  }

  @Get('clubs/:clubId/withdrawals')
  clubWithdrawals(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string) {
    return this.withdrawalsService.listClub(user, clubId);
  }

  @Get('withdrawals')
  platformWithdrawals(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    return this.withdrawalsService.listPlatform(user, status);
  }

  @Patch('withdrawals/:id/review')
  reviewWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ReviewWithdrawalDto,
  ) {
    return this.withdrawalsService.review(user, id, body.action, body.reason);
  }

  @Patch('withdrawals/:id/processing')
  processWithdrawal(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.withdrawalsService.markProcessing(user, id);
  }

  @Patch('withdrawals/:id/paid')
  payWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: PayWithdrawalDto,
  ) {
    return this.withdrawalsService.markPaid(user, id, body.paymentReference, body.proofUrl);
  }

  @Patch('withdrawals/:id/failed')
  failWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: FailWithdrawalDto,
  ) {
    return this.withdrawalsService.markFailed(user, id, body.reason);
  }
}
