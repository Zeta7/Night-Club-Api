import { Body, Controller, Get, Header, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { CommerceService } from '../application/commerce.service';
import { FlowPaymentGateway } from '../infrastructure/flow-payment.gateway';

@ApiTags('Flow Payments')
@Controller('payments/flow')
export class FlowPaymentsController {
  constructor(
    private readonly flow: FlowPaymentGateway,
    private readonly commerce: CommerceService,
    private readonly config: ConfigService,
  ) {}

  @Post('confirmation')
  async confirmation(@Body('token') token: string) {
    const event = await this.flow.verifyPaymentToken(token);
    await this.commerce.processPaymentEvent(event);
    return { received: true };
  }

  @Post('return')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store, max-age=0')
  async returnPost(@Body('token') token?: string) {
    return this.handleReturn(token);
  }

  @Get('return')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store, max-age=0')
  async returnGet(@Query('token') token?: string) {
    return this.handleReturn(token);
  }

  private async handleReturn(token?: string) {
    let params = new URLSearchParams({ provider: 'flow' });
    if (token?.trim()) {
      try {
        const event = await this.flow.verifyPaymentToken(token);
        await this.commerce.processPaymentEvent(event);
        const context = await this.commerce.getPaymentReturnContext(event.externalPaymentId);
        if (context) {
          params = new URLSearchParams({
            provider: context.provider,
            attemptId: context.attemptId,
            operationType: context.operationType,
            operationId: context.operationId ?? '',
          });
        }
      } catch {
        params.set('status', 'PENDING');
      }
    }
    const appScheme = this.config
      .get<string>('MOBILE_APP_SCHEME', 'beerry')
      .replace(/[^a-zA-Z0-9+.-]/g, '');
    return this.returnPage(`${appScheme}://payments/result?${params.toString()}`, appScheme);
  }

  private returnPage(appUrl: string, appScheme: string) {
    const safeAppUrl = JSON.stringify(appUrl).replace(/</g, '\\u003c');
    const androidPackage = this.config
      .get<string>('MOBILE_ANDROID_PACKAGE', 'com.beerry.app')
      .replace(/[^a-zA-Z0-9._]/g, '');
    const intentUrl =
      appUrl.replace(`${appScheme}://`, 'intent://') +
      `#Intent;scheme=${appScheme};package=${androidPackage};end`;
    const safeIntentUrl = JSON.stringify(intentUrl).replace(/</g, '\\u003c');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Volviendo a Beerry</title><style>body{margin:0;background:#100a18;color:#fff;font-family:Arial,sans-serif;text-align:center}.card{max-width:420px;margin:12vh auto;padding:32px 22px}.logo{font-size:28px;font-weight:900;color:#ff8a1f}p{color:#c8bdd2;line-height:1.5}a{display:inline-block;margin-top:18px;padding:14px 22px;border-radius:12px;background:linear-gradient(90deg,#ff3975,#ffa600);color:#fff;text-decoration:none;font-weight:800}</style></head><body><main class="card"><div class="logo">BEERRY</div><h1>Pago procesado</h1><p>Estamos volviendo a la aplicación para mostrarte el resultado confirmado.</p><a id="return-link" href="#" target="_self">Volver a Beerry</a></main><script>const appUrl=${safeAppUrl};const intentUrl=${safeIntentUrl};const isAndroid=/Android/i.test(navigator.userAgent);const destination=isAndroid?intentUrl:appUrl;const link=document.getElementById('return-link');link.href=destination;link.addEventListener('click',()=>{window.location.href=destination});setTimeout(()=>{window.location.href=destination},350);</script></body></html>`;
  }
}
