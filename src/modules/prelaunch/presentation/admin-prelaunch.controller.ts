import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { SuperAdminGuard } from '../../platform/presentation/guards/super-admin.guard';
import { PreLaunchService } from '../application/prelaunch.service';
import {
  AdminPreLaunchQueryDto,
  PublishBusinessPreLaunchApplicationDto,
  UpdateBusinessApplicationStatusDto,
  UpsertLaunchMarketDto,
  UpsertPreLaunchPartnerDto,
} from './dto/prelaunch.dto';
import {
  PreLaunchAdminDashboardResponseDto,
  PreLaunchAdminLeadsResponseDto,
  PreLaunchAdminMarketDetailResponseDto,
  PreLaunchEntityResponseDto,
  PreLaunchPublishedApplicationResponseDto,
} from './prelaunch.response.dto';

@ApiTags('Prelanzamiento administración')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, SuperAdminGuard)
@Controller('platform/prelaunch')
export class AdminPreLaunchController {
  constructor(private readonly prelaunch: PreLaunchService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Consultar el embudo y métricas del prelanzamiento' })
  @ApiResponse({ status: 200, type: PreLaunchAdminDashboardResponseDto })
  dashboard() {
    return this.prelaunch.adminDashboard();
  }
  @Get('leads')
  @ApiOperation({ summary: 'Listar registros de acceso anticipado' })
  @ApiResponse({ status: 200, type: PreLaunchAdminLeadsResponseDto })
  leads(@Query() query: AdminPreLaunchQueryDto) {
    return this.prelaunch.adminLeads(query);
  }
  @Get('markets') @ApiResponse({ status: 200, type: [PreLaunchEntityResponseDto] }) markets() {
    return this.prelaunch.adminMarkets();
  }
  @Get('markets/:id/detail')
  @ApiResponse({ status: 200, type: PreLaunchAdminMarketDetailResponseDto })
  marketDetail(@Param('id') id: string) {
    return this.prelaunch.adminMarketDetail(id);
  }
  @Post('markets') @ApiResponse({ status: 201, type: PreLaunchEntityResponseDto }) createMarket(
    @Body() body: UpsertLaunchMarketDto,
  ) {
    return this.prelaunch.upsertMarket(undefined, body);
  }
  @Put('markets/:id') @ApiResponse({ status: 200, type: PreLaunchEntityResponseDto }) updateMarket(
    @Param('id') id: string,
    @Body() body: UpsertLaunchMarketDto,
  ) {
    return this.prelaunch.upsertMarket(id, body);
  }
  @Get('business-applications')
  @ApiResponse({ status: 200, type: [PreLaunchEntityResponseDto] })
  applications() {
    return this.prelaunch.adminApplications();
  }
  @Patch('business-applications/:id/status')
  @ApiResponse({ status: 200, type: PreLaunchEntityResponseDto })
  applicationStatus(@Param('id') id: string, @Body() body: UpdateBusinessApplicationStatusDto) {
    return this.prelaunch.updateApplicationStatus(id, body.status);
  }
  @Post('business-applications/:id/publish')
  @ApiResponse({ status: 201, type: PreLaunchPublishedApplicationResponseDto })
  publishApplication(
    @Param('id') id: string,
    @Body() body: PublishBusinessPreLaunchApplicationDto,
  ) {
    return this.prelaunch.publishBusinessApplication(id, body);
  }
  @Get('partners') @ApiResponse({ status: 200, type: [PreLaunchEntityResponseDto] }) partners() {
    return this.prelaunch.adminPartners();
  }
  @Post('partners') @ApiResponse({ status: 201, type: PreLaunchEntityResponseDto }) createPartner(
    @Body() body: UpsertPreLaunchPartnerDto,
  ) {
    return this.prelaunch.upsertPartner(undefined, body);
  }
  @Put('partners/:id')
  @ApiResponse({ status: 200, type: PreLaunchEntityResponseDto })
  updatePartner(@Param('id') id: string, @Body() body: UpsertPreLaunchPartnerDto) {
    return this.prelaunch.upsertPartner(id, body);
  }
  @Post('leads/:leadId/convert/:userId')
  @ApiResponse({ status: 201, type: PreLaunchEntityResponseDto })
  convert(@Param('leadId') leadId: string, @Param('userId') userId: string) {
    return this.prelaunch.convertLead(leadId, userId);
  }
}
