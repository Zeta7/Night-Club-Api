import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { IdentityModule } from '../identity/identity.module';
import { PlatformModule } from '../platform/platform.module';
import { FeaturedCampaignsService } from './application/featured-campaigns.service';
import {
  FeaturedCampaignPaymentsController,
  FeaturedCampaignsController,
} from './presentation/featured-campaigns.controller';

@Module({
  imports: [CommerceModule, IdentityModule, PlatformModule],
  controllers: [FeaturedCampaignsController, FeaturedCampaignPaymentsController],
  providers: [FeaturedCampaignsService],
  exports: [FeaturedCampaignsService],
})
export class FeaturedCampaignsModule {}
