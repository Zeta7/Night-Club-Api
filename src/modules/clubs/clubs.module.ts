import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ClubWorkersService } from './application/club-workers.service';
import { ClubsService } from './application/clubs.service';
import { ClubWorkersController } from './presentation/club-workers.controller';
import { ClubsController } from './presentation/clubs.controller';

@Module({
  imports: [IdentityModule, UploadsModule],
  controllers: [ClubWorkersController, ClubsController],
  providers: [ClubWorkersService, ClubsService],
})
export class ClubsModule {}
