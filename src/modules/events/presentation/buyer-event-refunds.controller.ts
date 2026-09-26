import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { EventsService } from '../application/events.service';
import { BuyerRefundRequestResponseDto } from './cancellation.response.dto';
import { EventReasonDto } from './dto/reschedule-event.dto';

@UseGuards(AccessTokenGuard)
@Controller('events/me')
export class BuyerEventRefundsController {
  constructor(private readonly events: EventsService) {}
  @ApiResponse({ status: 201, type: BuyerRefundRequestResponseDto })
  @Post('purchases/:orderItemId/replacement-refund')
  request(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderItemId') id: string,
    @Body() body: EventReasonDto,
  ): Promise<BuyerRefundRequestResponseDto> {
    return this.events.requestReplacementRefund(user, id, body);
  }
}
