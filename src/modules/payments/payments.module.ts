import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { SellerConnectionService } from './application/seller-connection.service';
import { MercadoPagoOAuthClient } from './infrastructure/mercado-pago-oauth.client';
import { SellerCredentialCipher } from './infrastructure/seller-credential-cipher';
import {
  MercadoPagoConnectionsController,
  MercadoPagoOAuthCallbackController,
} from './presentation/mercado-pago-connections.controller';

@Module({
  imports: [IdentityModule, AuditModule],
  controllers: [MercadoPagoConnectionsController, MercadoPagoOAuthCallbackController],
  providers: [SellerConnectionService, MercadoPagoOAuthClient, SellerCredentialCipher],
  exports: [SellerConnectionService, SellerCredentialCipher],
})
export class PaymentsModule {}
