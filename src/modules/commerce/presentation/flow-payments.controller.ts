import { Body, Controller, Get, Header, Post, Query } from '@nestjs/common';
import { CommerceService } from '../application/commerce.service';
import { FlowPaymentGateway } from '../infrastructure/flow-payment.gateway';

@Controller('payments/flow')
export class FlowPaymentsController {
  constructor(
    private readonly flow: FlowPaymentGateway,
    private readonly commerce: CommerceService,
  ) {}

  @Post('confirmation')
  async confirmation(@Body('token') token: string) {
    const event = await this.flow.verifyPaymentToken(token);
    await this.commerce.processPaymentEvent(event);
    return { received: true };
  }

  @Post('return')
  @Header('Content-Type', 'text/html; charset=utf-8')
  returnPost(@Body('token') token?: string) {
    return this.returnPage(token);
  }

  @Get('return')
  @Header('Content-Type', 'text/html; charset=utf-8')
  returnGet(@Query('token') token?: string) {
    return this.returnPage(token);
  }

  private returnPage(token?: string) {
    const safeToken = encodeURIComponent(token ?? '');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Beerry</title></head><body style="background:#0e1522;color:#fff;font-family:Arial,sans-serif;text-align:center;padding:48px 20px"><h1>Confirmando tu pago</h1><p>Regresa a Beerry para consultar el resultado definitivo.</p><p><a style="color:#b5ccff" href="beerry://payments/result?token=${safeToken}">Volver a Beerry</a></p></body></html>`;
  }
}
