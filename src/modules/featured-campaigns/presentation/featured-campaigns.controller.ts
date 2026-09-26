import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { FeaturedCampaignsService } from '../application/featured-campaigns.service';
import { CreateFeaturedCheckoutDto } from './create-featured-checkout.dto';
import {
  FeaturedCampaignCheckoutResponseDto,
  FeaturedCampaignManagementResponseDto,
} from './featured-campaigns.response.dto';

@ApiTags('Featured Campaigns')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/featured-campaigns')
export class FeaturedCampaignsController {
  constructor(private readonly campaigns: FeaturedCampaignsService) {}

  @ApiResponse({ status: 200, type: FeaturedCampaignManagementResponseDto })
  @Get()
  @ApiOperation({ summary: 'Obtener ofertas, eventos y promociones contratadas' })
  getManagement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<FeaturedCampaignManagementResponseDto> {
    return this.campaigns.getManagement(user, clubId);
  }

  @ApiResponse({ status: 201, type: FeaturedCampaignCheckoutResponseDto })
  @Post('checkout')
  @ApiOperation({ summary: 'Crear el pago de una promoción de negocio o evento' })
  createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: CreateFeaturedCheckoutDto,
  ): Promise<FeaturedCampaignCheckoutResponseDto> {
    return this.campaigns.createCheckout(user, clubId, body);
  }

  @ApiResponse({ status: 200, type: FeaturedCampaignCheckoutResponseDto })
  @Get(':campaignId/payment')
  @ApiOperation({ summary: 'Consultar el estado del pago y de la promoción' })
  getPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('campaignId') campaignId: string,
  ): Promise<FeaturedCampaignCheckoutResponseDto> {
    return this.campaigns.getPayment(user, clubId, campaignId);
  }
}

@ApiTags('Featured Campaigns')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('featured-campaigns')
export class FeaturedCampaignPaymentsController {
  constructor(private readonly campaigns: FeaturedCampaignsService) {}

  @ApiResponse({ status: 200, type: FeaturedCampaignCheckoutResponseDto })
  @Get(':campaignId/payment')
  @ApiOperation({ summary: 'Consultar un pago de promoción por campaña' })
  getPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId') campaignId: string,
  ): Promise<FeaturedCampaignCheckoutResponseDto> {
    return this.campaigns.getPaymentById(user, campaignId);
  }
}
