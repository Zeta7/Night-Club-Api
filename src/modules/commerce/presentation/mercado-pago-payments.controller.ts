import { Body, Controller, Headers, Logger, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { unauthorized } from '../../../shared/presentation/api-exception';
import { CommerceService } from '../application/commerce.service';
import { MercadoPagoPaymentGateway } from '../infrastructure/mercado-pago-payment.gateway';

@Controller('payments/mercado-pago')
export class MercadoPagoPaymentsController {
  private readonly logger = new Logger(MercadoPagoPaymentsController.name);

  constructor(
    private readonly mercadoPago: MercadoPagoPaymentGateway,
    private readonly commerce: CommerceService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  @ApiExcludeEndpoint()
  async webhook(
    @Query('data.id') queryDataId: string | undefined,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: Record<string, any>,
  ) {
    const dataId = queryDataId ?? String(body?.data?.id ?? '');
    this.logger.log(
      JSON.stringify({
        event: 'mercado_pago.webhook.received',
        requestId: requestId ?? null,
        type: typeof body?.type === 'string' ? body.type : null,
        dataId: dataId || null,
        sellerId: body?.user_id == null ? null : String(body.user_id),
        hasSignature: Boolean(signature),
      }),
    );
    try {
      this.verifySignature(signature, requestId, dataId);
      if (body?.type !== 'payment' || !dataId) return { received: true };
      const sellerId = String(body.user_id ?? '');
      if (!sellerId)
        throw unauthorized(
          'MERCADO_PAGO_SELLER_REQUIRED',
          'La notificación no identifica al vendedor.',
        );
      const event = await this.mercadoPago.queryPayment(dataId, sellerId);
      await this.commerce.bindAuthoritativeExternalPayment(event);
      await this.commerce.processPaymentEvent(event);
      this.logger.log(
        JSON.stringify({
          event: 'mercado_pago.webhook.processed',
          requestId: requestId ?? null,
          dataId,
          sellerId,
          attemptId: event.attemptId ?? null,
          orderId: event.orderId ?? null,
          outcome: event.outcome,
        }),
      );
      return { received: true };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'mercado_pago.webhook.failed',
          requestId: requestId ?? null,
          dataId: dataId || null,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  }

  private verifySignature(
    header: string | undefined,
    requestId: string | undefined,
    dataId: string,
  ) {
    const secret = this.config.get<string>('MERCADO_PAGO_WEBHOOK_SECRET')?.trim();
    if (!secret || !header || !requestId || !dataId)
      throw unauthorized('INVALID_MERCADO_PAGO_SIGNATURE', 'La firma del webhook es inválida.');
    const parts = Object.fromEntries(header.split(',').map((part) => part.trim().split('=', 2)));
    if (!parts.ts || !parts.v1)
      throw unauthorized('INVALID_MERCADO_PAGO_SIGNATURE', 'La firma del webhook es inválida.');
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(parts.v1, 'hex');
    } catch {
      throw unauthorized('INVALID_MERCADO_PAGO_SIGNATURE', 'La firma del webhook es inválida.');
    }
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      throw unauthorized('INVALID_MERCADO_PAGO_SIGNATURE', 'La firma del webhook es inválida.');
  }
}
