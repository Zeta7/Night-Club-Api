import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { forbidden } from '../../../shared/presentation/api-exception';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { ReferralsService } from '../application/referrals.service';
import {
  AssociateReferralDto,
  ReferralAdminQueryDto,
  TransferCreditDto,
  UpdateReferralSettingsDto,
} from './referral.dto';
import {
  ReferralAssociationResponseDto,
  ReferralOverviewResponseDto,
  ReferralPreviewResponseDto,
  ReferralRewardsResponseDto,
  ReferralSettingsResponseDto,
  ReferralTransferResponseDto,
} from './referrals.response.dto';

@ApiTags('Referrals')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  @ApiOperation({
    summary: 'Obtener mi programa de referidos (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
  })
  @ApiResponse({ status: 200, type: ReferralOverviewResponseDto })
  @Get('referrals/me')
  mine(@CurrentUser() user: AuthenticatedUser): Promise<ReferralOverviewResponseDto> {
    return this.service.getMine(user);
  }
  @ApiOperation({
    summary: 'Previsualizar un código de referido (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
  })
  @ApiResponse({ status: 200, type: ReferralPreviewResponseDto })
  @Get('referrals/preview/:code')
  preview(@Param('code') code: string): Promise<ReferralPreviewResponseDto> {
    return this.service.preview(code);
  }
  @ApiOperation({ summary: 'Asociar un referido (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)' })
  @ApiResponse({ status: 201, type: ReferralAssociationResponseDto })
  @Post('referrals/associate')
  associate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AssociateReferralDto,
  ): Promise<ReferralAssociationResponseDto> {
    return this.service.associate(user, body.code, body.captureMethod);
  }
  @ApiOperation({
    summary: 'Transferir recompensas de referidos (CUSTOMER, WORKER, ADMIN, SUPER_ADMIN)',
  })
  @ApiResponse({ status: 201, type: ReferralTransferResponseDto })
  @Post('referrals/transfers')
  transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: TransferCreditDto,
  ): Promise<ReferralTransferResponseDto> {
    return this.service.transfer(user, body);
  }

  @ApiOperation({ summary: 'Obtener la configuración de referidos (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: ReferralSettingsResponseDto })
  @Get('platform/referrals/settings')
  settings(@CurrentUser() user: AuthenticatedUser): Promise<ReferralSettingsResponseDto> {
    this.assertAdmin(user);
    return this.service.getSettings();
  }
  @ApiOperation({ summary: 'Actualizar la configuración de referidos (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: ReferralSettingsResponseDto })
  @Patch('platform/referrals/settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateReferralSettingsDto,
  ): Promise<ReferralSettingsResponseDto> {
    return this.service.updateSettings(user, body);
  }
  @ApiOperation({ summary: 'Listar recompensas de referidos (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: ReferralRewardsResponseDto })
  @Get('platform/referrals/rewards')
  rewards(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReferralAdminQueryDto,
  ): Promise<ReferralRewardsResponseDto> {
    return this.service.adminList(user, query);
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (user.role !== 'SUPER_ADMIN')
      throw forbidden('SUPER_ADMIN_REQUIRED', 'Solo Super Admin puede administrar referidos.');
  }
}
