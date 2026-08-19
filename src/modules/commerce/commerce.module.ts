import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommerceController } from './presentation/commerce.controller';
import { FlowPaymentsController } from './presentation/flow-payments.controller';
import { CommerceService } from './application/commerce.service';
import { IdentityModule } from '../identity/identity.module';
import { UploadsModule } from '../uploads/uploads.module';
import { PAYMENT_GATEWAY } from './application/ports/payment-gateway.port';
import { SimulatedPaymentGateway } from './infrastructure/simulated-payment.gateway';
import { FlowPaymentGateway } from './infrastructure/flow-payment.gateway';
import { NotificationModule } from '../notification/notification.module';
import { WalletsModule } from '../wallets/wallets.module';
import { EventsModule } from '../events/events.module';
import { ReferralsModule } from '../referrals/referrals.module';

@Module({
  imports: [
    IdentityModule,
    UploadsModule,
    NotificationModule,
    WalletsModule,
    EventsModule,
    ReferralsModule,
  ],
  controllers: [CommerceController, FlowPaymentsController],
  providers: [
    CommerceService,
    SimulatedPaymentGateway,
    FlowPaymentGateway,
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService, SimulatedPaymentGateway, FlowPaymentGateway],
      useFactory: (
        config: ConfigService,
        simulated: SimulatedPaymentGateway,
        flow: FlowPaymentGateway,
      ) => {
        const provider = config.get<string>('PAYMENT_PROVIDER', 'simulated').toLowerCase();
        if (provider === 'flow') return flow;
        if (provider !== 'simulated') throw new Error(`PAYMENT_PROVIDER_NOT_SUPPORTED:${provider}`);
        return simulated;
      },
    },
  ],
})
export class CommerceModule {}
