import { Body, Controller, Get, Header, Headers, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { unauthorized } from '../../../shared/presentation/api-exception';
import { CommerceService } from '../application/commerce.service';
import { MercadoPagoPaymentGateway } from '../infrastructure/mercado-pago-payment.gateway';

@Controller('payments/mercado-pago')
export class MercadoPagoPaymentsController {
  constructor(
    private readonly mercadoPago: MercadoPagoPaymentGateway,
    private readonly commerce: CommerceService,
    private readonly config: ConfigService,
  ) {}

  @Get('return')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store, max-age=0')
  @ApiExcludeEndpoint()
  async paymentReturn(
    @Query('external_reference') externalReference?: string,
    @Query('preference_id') preferenceId?: string,
    @Query('payment_id') paymentId?: string,
  ) {
    const reference = externalReference || preferenceId || paymentId || '';
    const context = reference ? await this.commerce.getPaymentReturnContext(reference) : null;
    const query = context
      ? new URLSearchParams({
          provider: 'mercado_pago',
          attemptId: context.attemptId,
          operationType: context.operationType,
          operationId: context.operationId ?? '',
        }).toString()
      : new URLSearchParams({ provider: 'mercado_pago' }).toString();
    const scheme = this.config
      .get<string>('MOBILE_APP_SCHEME', 'beerry')
      .replace(/[^a-zA-Z0-9+.-]/g, '');
    const deepLink = `${scheme}://payments/result?${query}`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Volver a Beerry</title></head><body><main><h1>Regresa a Beerry</h1><p>La aplicación verificará el estado directamente con el proveedor.</p><p><a href="${deepLink}">Abrir Beerry</a></p></main><script>location.replace(${JSON.stringify(deepLink)})</script></body></html>`;
  }

  @Post('webhook')
  @ApiExcludeEndpoint()
  async webhook(
    @Query('data.id') queryDataId: string | undefined,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: Record<string, any>,
  ) {
    const dataId = queryDataId ?? String(body?.data?.id ?? '');
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
    return { received: true };
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
