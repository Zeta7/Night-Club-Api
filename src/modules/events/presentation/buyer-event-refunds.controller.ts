import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { EventsService } from '../application/events.service';
import { EventReasonDto } from './dto/reschedule-event.dto';

@UseGuards(AccessTokenGuard)
@Controller('events/me')
export class BuyerEventRefundsController {
  constructor(private readonly events: EventsService) {}
  @Post('purchases/:orderItemId/replacement-refund')
  request(@CurrentUser() user: AuthenticatedUser, @Param('orderItemId') id: string, @Body() body: EventReasonDto) {
    return this.events.requestReplacementRefund(user, id, body);
  }
}
