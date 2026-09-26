import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { SuperAdminGuard } from '../../platform/presentation/guards/super-admin.guard';
import { BusinessAccessService } from '../application/business-access.service';
import {
  AdminBusinessAccessRequestsResponseDto,
  ApprovedBusinessAccessResponseDto,
  BusinessAccessRequestDetailResponseDto,
  BusinessAccessRequestRecordResponseDto,
} from './business-access.response.dto';
import { ListBusinessAccessRequestsDto } from './dto/list-business-access-requests.dto';
import { ReviewBusinessAccessRequestDto } from './dto/review-business-access-request.dto';

@ApiTags('Admin business access requests')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, SuperAdminGuard)
@Controller('admin/business-access-requests')
export class AdminBusinessAccessController {
  constructor(private readonly service: BusinessAccessService) {}

  @ApiResponse({ status: 200, type: AdminBusinessAccessRequestsResponseDto })
  @Get()
  @ApiOperation({
    summary: 'Listar solicitudes comerciales con paginación y filtros (SUPER_ADMIN)',
  })
  list(
    @Query() query: ListBusinessAccessRequestsDto,
  ): Promise<AdminBusinessAccessRequestsResponseDto> {
    return this.service.list(query);
  }

  @ApiResponse({ status: 200, type: BusinessAccessRequestDetailResponseDto })
  @Get(':id')
  @ApiOperation({ summary: 'Consultar una solicitud comercial (SUPER_ADMIN)' })
  get(@Param('id') id: string): Promise<BusinessAccessRequestDetailResponseDto> {
    return this.service.getAdmin(id);
  }

  @ApiResponse({ status: 201, type: BusinessAccessRequestDetailResponseDto })
  @Post(':id/start-review')
  @ApiOperation({ summary: 'Iniciar revisión de una solicitud (SUPER_ADMIN)' })
  startReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<BusinessAccessRequestDetailResponseDto> {
    return this.service.startReview(user, id);
  }

  @ApiResponse({ status: 201, type: ApprovedBusinessAccessResponseDto })
  @Post(':id/approve')
  @ApiOperation({ summary: 'Aprobar y asignar administración del negocio (SUPER_ADMIN)' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ReviewBusinessAccessRequestDto,
  ): Promise<ApprovedBusinessAccessResponseDto> {
    return this.service.approve(user, id, body.comment);
  }

  @ApiResponse({ status: 201, type: BusinessAccessRequestRecordResponseDto })
  @Post(':id/reject')
  @ApiOperation({ summary: 'Rechazar una solicitud comercial (SUPER_ADMIN)' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ReviewBusinessAccessRequestDto,
  ): Promise<BusinessAccessRequestRecordResponseDto> {
    return this.service.reject(user, id, body.comment);
  }
}
