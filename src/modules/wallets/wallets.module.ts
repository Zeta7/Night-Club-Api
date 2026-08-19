import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { WalletsService } from './application/wallets.service';
import { WalletsController } from './presentation/wallets.controller';
import { LedgerService } from './application/ledger.service';
import { WithdrawalsService } from './application/withdrawals.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [IdentityModule, NotificationModule],
  controllers: [WalletsController],
  providers: [WalletsService, LedgerService, WithdrawalsService],
  exports: [LedgerService],
})
export class WalletsModule {}
