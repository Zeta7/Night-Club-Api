import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Prelanzamiento administración')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, SuperAdminGuard)
@Controller('platform/prelaunch')
export class AdminPreLaunchController {
  constructor(private readonly prelaunch: PreLaunchService) {}

  @Get('dashboard') @ApiOperation({ summary: 'Consultar el embudo y métricas del prelanzamiento' }) dashboard() { return this.prelaunch.adminDashboard(); }
  @Get('leads') @ApiOperation({ summary: 'Listar registros de acceso anticipado' }) leads(@Query() query: AdminPreLaunchQueryDto) { return this.prelaunch.adminLeads(query); }
  @Get('markets') markets() { return this.prelaunch.adminMarkets(); }
  @Get('markets/:id/detail') marketDetail(@Param('id') id: string) { return this.prelaunch.adminMarketDetail(id); }
  @Post('markets') createMarket(@Body() body: UpsertLaunchMarketDto) { return this.prelaunch.upsertMarket(undefined, body); }
  @Put('markets/:id') updateMarket(@Param('id') id: string, @Body() body: UpsertLaunchMarketDto) { return this.prelaunch.upsertMarket(id, body); }
  @Get('business-applications') applications() { return this.prelaunch.adminApplications(); }
  @Patch('business-applications/:id/status') applicationStatus(@Param('id') id: string, @Body() body: UpdateBusinessApplicationStatusDto) { return this.prelaunch.updateApplicationStatus(id, body.status); }
  @Post('business-applications/:id/publish') publishApplication(@Param('id') id: string, @Body() body: PublishBusinessPreLaunchApplicationDto) { return this.prelaunch.publishBusinessApplication(id, body); }
  @Get('partners') partners() { return this.prelaunch.adminPartners(); }
  @Post('partners') createPartner(@Body() body: UpsertPreLaunchPartnerDto) { return this.prelaunch.upsertPartner(undefined, body); }
  @Put('partners/:id') updatePartner(@Param('id') id: string, @Body() body: UpsertPreLaunchPartnerDto) { return this.prelaunch.upsertPartner(id, body); }
  @Post('leads/:leadId/convert/:userId') convert(@Param('leadId') leadId: string, @Param('userId') userId: string) { return this.prelaunch.convertLead(leadId, userId); }
}
