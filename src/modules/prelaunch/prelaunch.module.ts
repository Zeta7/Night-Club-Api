import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { NotificationModule } from '../notification/notification.module';
import { SuperAdminGuard } from '../platform/presentation/guards/super-admin.guard';
import { PreLaunchService } from './application/prelaunch.service';
import { UbigeoService } from './infrastructure/ubigeo.service';
import { AdminPreLaunchController } from './presentation/admin-prelaunch.controller';
import { PreLaunchController } from './presentation/prelaunch.controller';

@Module({
  imports: [IdentityModule, NotificationModule],
  controllers: [PreLaunchController, AdminPreLaunchController],
  providers: [PreLaunchService, UbigeoService, SuperAdminGuard],
  exports: [PreLaunchService],
})
export class PreLaunchModule {}
