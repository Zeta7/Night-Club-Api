import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { UploadsService } from './application/uploads.service';
import { UploadsController } from './presentation/uploads.controller';

@Module({
  imports: [IdentityModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
