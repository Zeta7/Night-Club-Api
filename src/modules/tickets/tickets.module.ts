import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { TicketsService } from './application/tickets.service';
import { ClubTicketsController } from './presentation/club-tickets.controller';
import { EventTicketsController } from './presentation/event-tickets.controller';

@Module({
  imports: [IdentityModule],
  controllers: [ClubTicketsController, EventTicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
