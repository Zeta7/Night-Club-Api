import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { UploadsModule } from '../uploads/uploads.module';
import { EventsService } from './application/events.service';
import { ClubEventsController } from './presentation/club-events.controller';
import { AdminEventsController } from './presentation/admin-events.controller';
import { PublicEventsController } from './presentation/public-events.controller';
import { CapacityService } from './application/capacity.service';
import { CapacityController } from './presentation/capacity.controller';

@Module({
  imports: [IdentityModule, UploadsModule],
  controllers: [AdminEventsController, ClubEventsController, PublicEventsController, CapacityController],
  providers: [EventsService, CapacityService],
  exports: [CapacityService],
})
export class EventsModule {}
