import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { UploadsModule } from '../uploads/uploads.module';
import { PromotionsService } from './application/promotions.service';
import { ClubPromotionsController } from './presentation/club-promotions.controller';

@Module({
  imports: [IdentityModule, UploadsModule],
  controllers: [ClubPromotionsController],
  providers: [PromotionsService],
})
export class PromotionsModule {}
