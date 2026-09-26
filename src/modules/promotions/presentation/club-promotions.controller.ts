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
import { MessageResponseDto } from '../../../shared/presentation/response.dto';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { PromotionsService } from '../application/promotions.service';
import { CreatePromotionDto, ListPromotionsQueryDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionResponseDto, PromotionsResponseDto } from './promotions.response.dto';

@ApiTags('Club Promotions')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/promotions')
export class ClubPromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @ApiResponse({
    type: PromotionResponseDto,
    status: 201,
    description: 'Promocion creada correctamente.',
  })
  createPromotion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Body() body: CreatePromotionDto,
  ): Promise<PromotionResponseDto> {
    return this.promotionsService.createPromotion(currentUser, clubId, body);
  }

  @Get()
  @ApiResponse({
    type: PromotionsResponseDto,
    status: 200,
    description: 'Promociones del club obtenidas correctamente.',
  })
  listPromotions(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Query() query: ListPromotionsQueryDto,
  ): Promise<PromotionsResponseDto> {
    return this.promotionsService.listPromotions(currentUser, clubId, query);
  }

  @Get(':promotionId')
  @ApiResponse({
    type: PromotionResponseDto,
    status: 200,
    description: 'Promocion obtenida correctamente.',
  })
  getPromotion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('promotionId') promotionId: string,
  ): Promise<PromotionResponseDto> {
    return this.promotionsService.getPromotion(currentUser, clubId, promotionId);
  }

  @Patch(':promotionId')
  @ApiResponse({
    type: PromotionResponseDto,
    status: 200,
    description: 'Promocion actualizada correctamente.',
  })
  updatePromotion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('promotionId') promotionId: string,
    @Body() body: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    return this.promotionsService.updatePromotion(currentUser, clubId, promotionId, body);
  }

  @Patch(':promotionId/activate')
  @ApiResponse({
    type: PromotionResponseDto,
    status: 200,
    description: 'Promocion activada correctamente.',
  })
  activatePromotion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('promotionId') promotionId: string,
  ): Promise<PromotionResponseDto> {
    return this.promotionsService.activatePromotion(currentUser, clubId, promotionId);
  }

  @Patch(':promotionId/deactivate')
  @ApiResponse({
    type: PromotionResponseDto,
    status: 200,
    description: 'Promocion desactivada correctamente.',
  })
  deactivatePromotion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('promotionId') promotionId: string,
  ): Promise<PromotionResponseDto> {
    return this.promotionsService.deactivatePromotion(currentUser, clubId, promotionId);
  }

  @Delete(':promotionId')
  @ApiResponse({
    type: MessageResponseDto,
    status: 200,
    description: 'Promocion eliminada correctamente.',
  })
  deletePromotion(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('clubId') clubId: string,
    @Param('promotionId') promotionId: string,
  ): Promise<MessageResponseDto> {
    return this.promotionsService.deletePromotion(currentUser, clubId, promotionId);
  }
}
