import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { forbidden } from '../../../shared/presentation/api-exception';
import { ReferralsService } from '../application/referrals.service';
import { AssociateReferralDto, ReferralAdminQueryDto, TransferCreditDto, UpdateReferralSettingsDto } from './referral.dto';

@ApiTags('Referrals')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  @Get('referrals/me') mine(@CurrentUser() user: AuthenticatedUser) { return this.service.getMine(user); }
  @Get('referrals/preview/:code') preview(@Param('code') code: string) { return this.service.preview(code); }
  @Post('referrals/associate') associate(@CurrentUser() user: AuthenticatedUser, @Body() body: AssociateReferralDto) { return this.service.associate(user, body.code, body.captureMethod); }
  @Post('referrals/transfers') transfer(@CurrentUser() user: AuthenticatedUser, @Body() body: TransferCreditDto) { return this.service.transfer(user, body); }

  @Get('platform/referrals/settings') settings(@CurrentUser() user: AuthenticatedUser) { this.assertAdmin(user); return this.service.getSettings(); }
  @Patch('platform/referrals/settings') updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateReferralSettingsDto) { return this.service.updateSettings(user, body); }
  @Get('platform/referrals/rewards') rewards(@CurrentUser() user: AuthenticatedUser, @Query() query: ReferralAdminQueryDto) { return this.service.adminList(user, query); }

  private assertAdmin(user: AuthenticatedUser) { if (user.role !== 'SUPER_ADMIN') throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo Super Admin puede administrar referidos.'); }
}
