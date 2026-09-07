import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PlatformService } from './application/platform.service';
import { PlatformController } from './presentation/platform.controller';
import { SuperAdminGuard } from './presentation/guards/super-admin.guard';
import { AuditModule } from '../audit/audit.module';
import { MarketplaceFeeService } from './application/marketplace-fee.service';
import { ClubMarketplaceFeeController } from './presentation/club-marketplace-fee.controller';

@Module({
  imports: [IdentityModule, AuditModule],
  controllers: [PlatformController, ClubMarketplaceFeeController],
  providers: [PlatformService, MarketplaceFeeService, SuperAdminGuard],
  exports: [MarketplaceFeeService],
})
export class PlatformModule {}
