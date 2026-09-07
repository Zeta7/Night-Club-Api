import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { NotificationModule } from '../notification/notification.module';
import { SuperAdminGuard } from '../platform/presentation/guards/super-admin.guard';
import { BusinessAccessService } from './application/business-access.service';
import { AdminBusinessAccessController } from './presentation/admin-business-access.controller';
import { BusinessAccessController } from './presentation/business-access.controller';

@Module({
  imports: [IdentityModule, AuditModule, NotificationModule],
  controllers: [BusinessAccessController, AdminBusinessAccessController],
  providers: [BusinessAccessService, SuperAdminGuard],
})
export class BusinessAccessModule {}
