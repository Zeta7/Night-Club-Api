import { Body, Controller, Get, Param, Patch, Post, Sse, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { CapacityService } from '../application/capacity.service';
import { CorrectCapacityDto, RegisterCapacityExitDto, UpdateCapacitySettingsDto } from './dto/capacity.dto';

@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/events/:eventId/capacity')
export class CapacityController {
  constructor(private readonly service: CapacityService) {}
  @Get() get(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string, @Param('eventId') eventId: string) { return this.service.get(user, clubId, eventId); }
  @Sse('stream') stream(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string, @Param('eventId') eventId: string) { return this.service.stream(user, clubId, eventId); }
  @Get('history') history(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string, @Param('eventId') eventId: string) { return this.service.history(user, clubId, eventId); }
  @Patch('settings') configure(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string, @Param('eventId') eventId: string, @Body() body: UpdateCapacitySettingsDto) { return this.service.configure(user, clubId, eventId, body.reentryAllowed); }
  @Post('exits') exit(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string, @Param('eventId') eventId: string, @Body() body: RegisterCapacityExitDto) { return this.service.registerExit(user, clubId, eventId, body.ticketId, body.idempotencyKey); }
  @Post('corrections') correct(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string, @Param('eventId') eventId: string, @Body() body: CorrectCapacityDto) { return this.service.correct(user, clubId, eventId, body.targetCount, body.reason, body.idempotencyKey); }
}
