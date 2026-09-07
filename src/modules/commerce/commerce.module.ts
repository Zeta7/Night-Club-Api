import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommerceController } from './presentation/commerce.controller';
import { CommerceService } from './application/commerce.service';
import { IdentityModule } from '../identity/identity.module';
import { UploadsModule } from '../uploads/uploads.module';
import {
  PAYMENT_GATEWAY,
  REFUND_GATEWAY,
  WALLET_TOP_UP_PAYMENT_GATEWAY,
} from './application/ports/payment-gateway.port';
import { SimulatedPaymentGateway } from './infrastructure/simulated-payment.gateway';
import { NotificationModule } from '../notification/notification.module';
import { WalletsModule } from '../wallets/wallets.module';
import { EventsModule } from '../events/events.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { PaymentsModule } from '../payments/payments.module';
import { PlatformModule } from '../platform/platform.module';
import { MercadoPagoPaymentGateway } from './infrastructure/mercado-pago-payment.gateway';
import { MercadoPagoPaymentsController } from './presentation/mercado-pago-payments.controller';

@Module({
  imports: [
    IdentityModule,
    UploadsModule,
    NotificationModule,
    WalletsModule,
    EventsModule,
    ReferralsModule,
    PaymentsModule,
    PlatformModule,
  ],
  controllers: [CommerceController, MercadoPagoPaymentsController],
  providers: [
    CommerceService,
    SimulatedPaymentGateway,
    MercadoPagoPaymentGateway,
    { provide: REFUND_GATEWAY, useExisting: MercadoPagoPaymentGateway },
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService, SimulatedPaymentGateway, MercadoPagoPaymentGateway],
      useFactory: (
        config: ConfigService,
        simulated: SimulatedPaymentGateway,
        mercadoPago: MercadoPagoPaymentGateway,
      ) => {
        const provider = config
          .get<string>(
            'ORDER_PAYMENT_PROVIDER',
            config.get<string>('PAYMENT_PROVIDER', 'mercado_pago'),
          )
          .toLowerCase();
        if (provider === 'mercado_pago') return mercadoPago;
        if (provider !== 'simulated' || config.get('NODE_ENV') === 'production')
          throw new Error(`PAYMENT_PROVIDER_NOT_SUPPORTED:${provider}`);
        return simulated;
      },
    },
    {
      provide: WALLET_TOP_UP_PAYMENT_GATEWAY,
      inject: [ConfigService, SimulatedPaymentGateway, MercadoPagoPaymentGateway],
      useFactory: (
        config: ConfigService,
        simulated: SimulatedPaymentGateway,
        mercadoPago: MercadoPagoPaymentGateway,
      ) => {
        const provider = config
          .get<string>(
            'WALLET_TOP_UP_PAYMENT_PROVIDER',
            config.get<string>('PAYMENT_PROVIDER', 'mercado_pago'),
          )
          .toLowerCase();
        if (provider === 'mercado_pago') return mercadoPago;
        if (provider !== 'simulated' || config.get('NODE_ENV') === 'production')
          throw new Error(`WALLET_TOP_UP_PAYMENT_PROVIDER_NOT_SUPPORTED:${provider}`);
        return simulated;
      },
    },
  ],
})
export class CommerceModule {}
