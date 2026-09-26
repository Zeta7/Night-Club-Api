import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { CommerceService } from '../application/commerce.service';
import { AddCartItemDto } from './add-cart-item.dto';
import { CheckoutDto } from './checkout.dto';
import { ClubOrdersQueryDto } from './club-orders-query.dto';
import {
  CartResponseDto,
  CheckoutResponseDto,
  PaymentOptionsResponseDto,
  RequestedRefundResponseDto,
  ReservationMetricsResponseDto,
  SimulatedPaymentResponseDto,
  WalletTopUpResponseDto,
  WalletTopUpsResponseDto,
} from './commerce.response.dto';
import {
  CodeValidationResponseDto,
  CommerceOperationsResponseDto,
  RedemptionAuditResponseDto,
  RedemptionReversalResponseDto,
} from './operations.response.dto';
import { ClubOrderResponseDto, ClubOrdersResponseDto } from './orders.response.dto';
import {
  OwnedConsumablesResponseDto,
  OwnedTicketsResponseDto,
} from './owned-resources.response.dto';
import { ProcessRefundDto } from './process-refund.dto';
import { RequestRefundDto } from './request-refund.dto';
import { ReverseRedemptionDto } from './reverse-redemption.dto';
import { SimulatePaymentDto } from './simulate-payment.dto';
import { UpdateCartItemDto } from './update-cart-item.dto';
import { UpdateProductDeliveryDto } from './update-product-delivery.dto';
import { ValidateCodeDto } from './validate-code.dto';
import { WalletTopUpDto } from './wallet-top-up.dto';

@ApiTags('Commerce')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class CommerceController {
  constructor(private readonly service: CommerceService) {}

  @ApiOperation({ summary: 'Completar el checkout del carrito' })
  @ApiResponse({ status: 201, type: CheckoutResponseDto })
  @Post('cart/checkout')
  @ApiInternalServerErrorResponse({
    description:
      'La configuración, red o respuesta de Mercado Pago produce un Error que el manejador predeterminado de NestJS convierte en 500.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/NestInternalServerError' },
        example: { statusCode: 500, message: 'Internal server error' },
      },
    },
  })
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CheckoutDto,
  ): Promise<CheckoutResponseDto> {
    return this.service.checkout(user, body);
  }

  @ApiResponse({ status: 200, type: PaymentOptionsResponseDto })
  @Get('cart/payment-options')
  paymentOptions(@CurrentUser() user: AuthenticatedUser): Promise<PaymentOptionsResponseDto> {
    return this.service.paymentOptions(user);
  }

  @ApiOperation({ summary: 'Obtener el carrito actual' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  @Get('cart')
  cart(@CurrentUser() user: AuthenticatedUser): Promise<CartResponseDto> {
    return this.service.getCart(user);
  }

  @ApiOperation({ summary: 'Añadir un ítem al carrito' })
  @ApiResponse({ status: 201, type: CartResponseDto })
  @Post('cart/items')
  addCartItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AddCartItemDto,
  ): Promise<CartResponseDto> {
    return this.service.addCartItem(user, body);
  }

  @ApiOperation({ summary: 'Actualizar un ítem del carrito' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  @Patch('cart/items/:cartItemId')
  updateCartItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cartItemId') cartItemId: string,
    @Body() body: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.service.updateCartItem(user, cartItemId, body.quantity);
  }

  @ApiResponse({ status: 200, type: CartResponseDto })
  @Patch('cart/product-delivery')
  updateProductDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProductDeliveryDto,
  ): Promise<CartResponseDto> {
    return this.service.updateProductDelivery(user, body);
  }

  @ApiOperation({ summary: 'Eliminar un ítem del carrito' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  @Delete('cart/items/:cartItemId')
  deleteCartItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cartItemId') cartItemId: string,
  ): Promise<CartResponseDto> {
    return this.service.deleteCartItem(user, cartItemId);
  }

  @ApiOperation({ summary: 'Obtener métricas de reservas' })
  @ApiResponse({ status: 200, type: ReservationMetricsResponseDto })
  @Get('clubs/:clubId/inventory/reservations/metrics')
  reservationMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<ReservationMetricsResponseDto> {
    return this.service.getReservationMetrics(user, clubId);
  }

  @ApiOperation({ summary: 'Obtener el estado del pago de una orden' })
  @ApiResponse({ status: 200, type: CheckoutResponseDto })
  @Get('orders/:orderId/payment')
  payment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ): Promise<CheckoutResponseDto> {
    return this.service.getPayment(user, orderId);
  }

  @ApiOperation({ summary: 'Crear una recarga de billetera' })
  @ApiResponse({ status: 201, type: WalletTopUpResponseDto })
  @Post('wallet/top-ups')
  @ApiInternalServerErrorResponse({
    description:
      'La configuración, red o respuesta de Mercado Pago produce un Error que el manejador predeterminado de NestJS convierte en 500.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/NestInternalServerError' },
        example: { statusCode: 500, message: 'Internal server error' },
      },
    },
  })
  createWalletTopUp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: WalletTopUpDto,
  ): Promise<WalletTopUpResponseDto> {
    return this.service.createWalletTopUp(user, body.amountCents, body.idempotencyKey);
  }

  @ApiOperation({ summary: 'Listar recargas de billetera' })
  @ApiResponse({ status: 200, type: WalletTopUpsResponseDto })
  @Get('wallet/top-ups')
  walletTopUps(@CurrentUser() user: AuthenticatedUser): Promise<WalletTopUpsResponseDto> {
    return this.service.listWalletTopUps(user);
  }

  @ApiOperation({ summary: 'Obtener una recarga de billetera' })
  @ApiResponse({ status: 200, type: WalletTopUpResponseDto })
  @Get('wallet/top-ups/:topUpId')
  walletTopUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topUpId') topUpId: string,
  ): Promise<WalletTopUpResponseDto> {
    return this.service.getWalletTopUp(user, topUpId);
  }

  @ApiOperation({ summary: 'Listar órdenes de un local nocturno' })
  @ApiResponse({ status: 200, type: ClubOrdersResponseDto })
  @Get('clubs/:clubId/orders')
  clubOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Query() query: ClubOrdersQueryDto,
  ): Promise<ClubOrdersResponseDto> {
    return this.service.listClubOrders(user, clubId, query);
  }

  @ApiOperation({ summary: 'Exportar órdenes de un local nocturno' })
  @Get('clubs/:clubId/orders/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="ventas-beerry.csv"')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'CSV UTF-8 con las órdenes visibles para el local nocturno.',
    headers: {
      'Content-Disposition': {
        description: 'Fuerza la descarga con el nombre ventas-beerry.csv.',
        schema: { type: 'string', example: 'attachment; filename="ventas-beerry.csv"' },
      },
    },
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          example: 'orderId,status,totalCents\nc4e91a67-3b58-4fd2-8a06-7d25e9c1b340,PAID,18500',
        },
      },
    },
  })
  exportClubOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Query() query: ClubOrdersQueryDto,
  ) {
    return this.service.exportClubOrders(user, clubId, query);
  }

  @ApiOperation({ summary: 'Obtener el detalle de una orden de un local nocturno' })
  @ApiResponse({ status: 200, type: ClubOrderResponseDto })
  @Get('clubs/:clubId/orders/:orderId')
  clubOrderDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('orderId') orderId: string,
  ): Promise<ClubOrderResponseDto> {
    return this.service.getClubOrder(user, clubId, orderId);
  }

  @ApiResponse({ status: 201, type: RequestedRefundResponseDto })
  @Post('clubs/:clubId/orders/:orderId/refund-requests')
  requestRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('orderId') orderId: string,
    @Body() body: RequestRefundDto,
  ): Promise<RequestedRefundResponseDto> {
    return this.service.requestOrderRefund(user, clubId, orderId, body.reason, body.amountCents);
  }

  @ApiResponse({ status: 201, type: RequestedRefundResponseDto })
  @Post('admin/refund-requests/:refundRequestId/process')
  processRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('refundRequestId') refundRequestId: string,
    @Body() body: ProcessRefundDto,
  ): Promise<RequestedRefundResponseDto> {
    return this.service.processRefundRequest(
      user,
      refundRequestId,
      body.approvedAmountCents,
      body.resolutionNote,
    );
  }

  @ApiOperation({ summary: 'Obtener el panel operativo de un local nocturno' })
  @ApiResponse({ status: 200, type: CommerceOperationsResponseDto })
  @Get('clubs/:clubId/operations')
  operations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<CommerceOperationsResponseDto> {
    return this.service.getClubOperations(user, clubId);
  }

  @ApiResponse({ status: 201, type: SimulatedPaymentResponseDto })
  @Post('payment-attempts/:attemptId/simulate')
  simulatePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId') attemptId: string,
    @Body() body: SimulatePaymentDto,
  ): Promise<SimulatedPaymentResponseDto> {
    return this.service.simulatePayment(user, attemptId, body.outcome);
  }

  @ApiResponse({ status: 201, type: CodeValidationResponseDto })
  @Post('clubs/:clubId/validate/ticket')
  validateTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: ValidateCodeDto,
  ): Promise<CodeValidationResponseDto> {
    return this.service.validateCode(
      user,
      clubId,
      'TICKET',
      body.qrCode?.trim() || body.code,
      body.confirm ?? false,
    );
  }

  @ApiOperation({ summary: 'Validar un código detectado' })
  @ApiResponse({ status: 201, type: CodeValidationResponseDto })
  @Post('clubs/:clubId/validate/code')
  validateDetectedCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: ValidateCodeDto,
  ): Promise<CodeValidationResponseDto> {
    return this.service.validateDetectedCode(
      user,
      clubId,
      body.qrCode?.trim() || body.code,
      body.confirm ?? false,
    );
  }

  @ApiResponse({ status: 201, type: CodeValidationResponseDto })
  @Post('clubs/:clubId/validate/product')
  validateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: ValidateCodeDto,
  ): Promise<CodeValidationResponseDto> {
    return this.service.validateCode(
      user,
      clubId,
      'PRODUCT',
      body.qrCode?.trim() || body.code,
      body.confirm ?? false,
    );
  }

  @ApiResponse({ status: 201, type: CodeValidationResponseDto })
  @Post('clubs/:clubId/validate/promotion')
  validatePromotion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: ValidateCodeDto,
  ): Promise<CodeValidationResponseDto> {
    return this.service.validateCode(
      user,
      clubId,
      'PROMOTION',
      body.qrCode?.trim() || body.code,
      body.confirm ?? false,
    );
  }

  @ApiOperation({ summary: 'Listar mis entradas' })
  @ApiResponse({ status: 200, type: OwnedTicketsResponseDto })
  @Get('me/tickets')
  tickets(@CurrentUser() user: AuthenticatedUser): Promise<OwnedTicketsResponseDto> {
    return this.service.listTickets(user);
  }

  @ApiResponse({ status: 201, type: RedemptionReversalResponseDto })
  @Post('clubs/:clubId/redemptions/:kind/:resourceId/reverse')
  @ApiParam({ name: 'kind', enum: ['TICKET', 'PRODUCT', 'PROMOTION'] })
  reverseRedemption(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('kind') kind: string,
    @Param('resourceId') resourceId: string,
    @Body() body: ReverseRedemptionDto,
  ): Promise<RedemptionReversalResponseDto> {
    return this.service.reverseRedemption(user, clubId, kind, resourceId, body.reason);
  }

  @ApiOperation({ summary: 'Listar mis consumibles' })
  @ApiResponse({ status: 200, type: OwnedConsumablesResponseDto })
  @Get('me/consumables')
  consumables(@CurrentUser() user: AuthenticatedUser): Promise<OwnedConsumablesResponseDto> {
    return this.service.listConsumables(user);
  }

  @ApiOperation({ summary: 'Listar validaciones auditadas' })
  @ApiResponse({ status: 200, type: RedemptionAuditResponseDto })
  @Get('audit-logs')
  auditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clubId') clubId: string,
  ): Promise<RedemptionAuditResponseDto> {
    return this.service.listValidationLogs(user, clubId);
  }
}
