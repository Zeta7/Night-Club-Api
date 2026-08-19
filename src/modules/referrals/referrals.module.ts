import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { NotificationModule } from '../notification/notification.module';
import { AuditModule } from '../audit/audit.module';
import { ReferralsService } from './application/referrals.service';
import { ReferralsController } from './presentation/referrals.controller';

@Module({
  imports: [IdentityModule, NotificationModule, AuditModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
