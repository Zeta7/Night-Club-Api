import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { UploadsCleanupService } from './application/uploads-cleanup.service';
import { UploadsService } from './application/uploads.service';
import { UploadsController } from './presentation/uploads.controller';

@Module({
  imports: [IdentityModule],
  controllers: [UploadsController],
  providers: [UploadsService, UploadsCleanupService],
  exports: [UploadsService],
})
export class UploadsModule {}
