import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PromotionStatus } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { PromotionsService } from '../application/promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@ApiTags('Club Promotions')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/promotions')
export class ClubPromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @ApiResponse({ status: 201, description: 'Promocion creada correctamente.' })
  createPromotion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: CreatePromotionDto,
  ) {
    return this.promotionsService.createPromotion(currentUser, clubId, body);
  }

  @Get()
  @ApiResponse({ status: 200, description: 'Promociones del club obtenidas correctamente.' })
  listPromotions(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Query('eventId') eventId?: string,
    @Query('status') status?: PromotionStatus,
  ) {
    return this.promotionsService.listPromotions(currentUser, clubId, { eventId, status });
  }

  @Get(':promotionId')
  @ApiResponse({ status: 200, description: 'Promocion obtenida correctamente.' })
  getPromotion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('promotionId') promotionId: string,
  ) {
    return this.promotionsService.getPromotion(currentUser, clubId, promotionId);
  }

  @Patch(':promotionId')
  @ApiResponse({ status: 200, description: 'Promocion actualizada correctamente.' })
  updatePromotion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('promotionId') promotionId: string,
    @Body() body: UpdatePromotionDto,
  ) {
    return this.promotionsService.updatePromotion(currentUser, clubId, promotionId, body);
  }

  @Patch(':promotionId/activate')
  @ApiResponse({ status: 200, description: 'Promocion activada correctamente.' })
  activatePromotion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('promotionId') promotionId: string,
  ) {
    return this.promotionsService.activatePromotion(currentUser, clubId, promotionId);
  }

  @Patch(':promotionId/deactivate')
  @ApiResponse({ status: 200, description: 'Promocion desactivada correctamente.' })
  deactivatePromotion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('promotionId') promotionId: string,
  ) {
    return this.promotionsService.deactivatePromotion(currentUser, clubId, promotionId);
  }

  @Delete(':promotionId')
  @ApiResponse({ status: 200, description: 'Promocion eliminada correctamente.' })
  deletePromotion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('promotionId') promotionId: string,
  ) {
    return this.promotionsService.deletePromotion(currentUser, clubId, promotionId);
  }
}
