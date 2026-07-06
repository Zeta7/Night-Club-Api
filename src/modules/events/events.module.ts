import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { EventsService } from './application/events.service';
import { ClubEventsController } from './presentation/club-events.controller';
import { AdminEventsController } from './presentation/admin-events.controller';
import { PublicEventsController } from './presentation/public-events.controller';

@Module({
  imports: [IdentityModule],
  controllers: [AdminEventsController, ClubEventsController, PublicEventsController],
  providers: [EventsService],
})
export class EventsModule {}
