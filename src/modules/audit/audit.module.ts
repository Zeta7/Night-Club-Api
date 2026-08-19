import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SuperAdminGuard } from '../platform/presentation/guards/super-admin.guard';
import { AuditService } from './application/audit.service';
import { AuditController } from './presentation/audit.controller';

@Module({ imports: [IdentityModule], controllers: [AuditController], providers: [AuditService, SuperAdminGuard], exports: [AuditService] })
export class AuditModule {}
