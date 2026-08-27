import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { CommerceService } from '../application/commerce.service';
import { CheckoutDto } from './checkout.dto';
import { ValidateCodeDto } from './validate-code.dto';
import { SimulatePaymentDto } from './simulate-payment.dto';
import { AddCartItemDto } from './add-cart-item.dto';
import { UpdateCartItemDto } from './update-cart-item.dto';
import { ReverseRedemptionDto } from './reverse-redemption.dto';
import { ClubOrdersQueryDto } from './club-orders-query.dto';
import { RequestRefundDto } from './request-refund.dto';
import { WalletTopUpDto } from './wallet-top-up.dto';

@ApiTags('Commerce')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class CommerceController {
  constructor(private readonly service: CommerceService) {}

  @Post('cart/checkout')
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() body: CheckoutDto) {
    return this.service.checkout(user, body);
  }

  @Get('cart')
  cart(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getCart(user);
  }

  @Post('cart/items')
  addCartItem(@CurrentUser() user: AuthenticatedUser, @Body() body: AddCartItemDto) {
    return this.service.addCartItem(user, body);
  }

  @Patch('cart/items/:cartItemId')
  updateCartItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cartItemId') cartItemId: string,
    @Body() body: UpdateCartItemDto,
  ) {
    return this.service.updateCartItem(user, cartItemId, body.quantity);
  }

  @Delete('cart/items/:cartItemId')
  deleteCartItem(@CurrentUser() user: AuthenticatedUser, @Param('cartItemId') cartItemId: string) {
    return this.service.deleteCartItem(user, cartItemId);
  }

  @Get('clubs/:clubId/inventory/reservations/metrics')
  reservationMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ) {
    return this.service.getReservationMetrics(user, clubId);
  }

  @Get('orders/:orderId/payment')
  payment(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.service.getPayment(user, orderId);
  }

  @Post('wallet/top-ups')
  createWalletTopUp(@CurrentUser() user: AuthenticatedUser, @Body() body: WalletTopUpDto) {
    return this.service.createWalletTopUp(user, body.amountCents, body.idempotencyKey);
  }

  @Get('wallet/top-ups')
  walletTopUps(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listWalletTopUps(user);
  }

  @Get('wallet/top-ups/:topUpId')
  walletTopUp(@CurrentUser() user: AuthenticatedUser, @Param('topUpId') topUpId: string) {
    return this.service.getWalletTopUp(user, topUpId);
  }

  @Get('clubs/:clubId/orders')
  clubOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Query() query: ClubOrdersQueryDto,
  ) {
    return this.service.listClubOrders(user, clubId, query);
  }

  @Get('clubs/:clubId/orders/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="ventas-beerry.csv"')
  exportClubOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Query() query: ClubOrdersQueryDto,
  ) {
    return this.service.exportClubOrders(user, clubId, query);
  }

  @Get('clubs/:clubId/orders/:orderId')
  clubOrderDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.service.getClubOrder(user, clubId, orderId);
  }

  @Post('clubs/:clubId/orders/:orderId/refund-requests')
  requestRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('orderId') orderId: string,
    @Body() body: RequestRefundDto,
  ) {
    return this.service.requestOrderRefund(user, clubId, orderId, body.reason);
  }

  @Get('clubs/:clubId/operations')
  operations(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string) {
    return this.service.getClubOperations(user, clubId);
  }

  @Post('payment-attempts/:attemptId/simulate')
  simulatePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId') attemptId: string,
    @Body() body: SimulatePaymentDto,
  ) {
    return this.service.simulatePayment(user, attemptId, body.outcome);
  }

  @Post('clubs/:clubId/validate/ticket')
  validateTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: ValidateCodeDto,
  ) {
    return this.service.validateCode(
      user,
      clubId,
      'TICKET',
      body.qrCode?.trim() || body.code,
      body.confirm ?? false,
    );
  }

  @Post('clubs/:clubId/validate/code')
  validateDetectedCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: ValidateCodeDto,
  ) {
    return this.service.validateDetectedCode(
      user,
      clubId,
      body.qrCode?.trim() || body.code,
      body.confirm ?? false,
    );
  }

  @Post('clubs/:clubId/validate/product')
  validateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: ValidateCodeDto,
  ) {
    return this.service.validateCode(
      user,
      clubId,
      'PRODUCT',
      body.qrCode?.trim() || body.code,
      body.confirm ?? false,
    );
  }

  @Post('clubs/:clubId/validate/promotion')
  validatePromotion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: ValidateCodeDto,
  ) {
    return this.service.validateCode(
      user,
      clubId,
      'PROMOTION',
      body.qrCode?.trim() || body.code,
      body.confirm ?? false,
    );
  }

  @Get('me/tickets')
  tickets(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listTickets(user);
  }

  @Post('clubs/:clubId/redemptions/:kind/:resourceId/reverse')
  reverseRedemption(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('kind') kind: string,
    @Param('resourceId') resourceId: string,
    @Body() body: ReverseRedemptionDto,
  ) {
    return this.service.reverseRedemption(user, clubId, kind, resourceId, body.reason);
  }

  @Get('me/consumables')
  consumables(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listConsumables(user);
  }

  @Get('audit-logs')
  auditLogs(@CurrentUser() user: AuthenticatedUser, @Query('clubId') clubId: string) {
    return this.service.listValidationLogs(user, clubId);
  }
}
