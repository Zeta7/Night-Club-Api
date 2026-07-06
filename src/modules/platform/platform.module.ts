import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PlatformService } from './application/platform.service';
import { PlatformController } from './presentation/platform.controller';
import { SuperAdminGuard } from './presentation/guards/super-admin.guard';

@Module({
  imports: [IdentityModule],
  controllers: [PlatformController],
  providers: [PlatformService, SuperAdminGuard],
})
export class PlatformModule {}
