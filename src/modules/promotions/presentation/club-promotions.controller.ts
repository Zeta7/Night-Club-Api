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
import { ApiOperation, ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
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

  @ApiOperation({ summary: 'Crear una promoción del club (ADMIN, SUPER_ADMIN)' })
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

  @ApiOperation({ summary: 'Listar las promociones del club (ADMIN, SUPER_ADMIN)' })
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

  @ApiOperation({ summary: 'Consultar una promoción del club (ADMIN, SUPER_ADMIN)' })
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

  @ApiOperation({ summary: 'Actualizar una promoción del club (ADMIN, SUPER_ADMIN)' })
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

  @ApiOperation({ summary: 'Activar una promoción del club (ADMIN, SUPER_ADMIN)' })
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

  @ApiOperation({ summary: 'Desactivar una promoción del club (ADMIN, SUPER_ADMIN)' })
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

  @ApiOperation({ summary: 'Eliminar una promoción del club (ADMIN, SUPER_ADMIN)' })
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
