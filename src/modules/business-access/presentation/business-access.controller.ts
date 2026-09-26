import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { BusinessAccessService } from '../application/business-access.service';
import {
  BusinessAccessRequestRecordResponseDto,
  MyBusinessAccessRequestResponseDto,
  MyBusinessAccessRequestsResponseDto,
} from './business-access.response.dto';
import { CreateBusinessAccessRequestDto } from './dto/create-business-access-request.dto';

@ApiTags('Business access requests')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('business-access-requests')
export class BusinessAccessController {
  constructor(private readonly service: BusinessAccessService) {}

  @ApiResponse({ status: 201, type: BusinessAccessRequestRecordResponseDto })
  @Post()
  @ApiOperation({ summary: 'Solicitar acceso para registrar o administrar un negocio' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateBusinessAccessRequestDto,
  ): Promise<BusinessAccessRequestRecordResponseDto> {
    return this.service.create(user, body);
  }

  @ApiResponse({ status: 200, type: MyBusinessAccessRequestsResponseDto })
  @Get('mine')
  @ApiOperation({ summary: 'Consultar mis solicitudes comerciales' })
  mine(@CurrentUser() user: AuthenticatedUser): Promise<MyBusinessAccessRequestsResponseDto> {
    return this.service.mine(user.id);
  }

  @ApiResponse({ status: 200, type: MyBusinessAccessRequestResponseDto })
  @Get(':id')
  @ApiOperation({ summary: 'Consultar una solicitud propia' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MyBusinessAccessRequestResponseDto> {
    return this.service.getMine(user.id, id);
  }

  @ApiResponse({ status: 201, type: MyBusinessAccessRequestResponseDto })
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancelar una solicitud propia pendiente' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MyBusinessAccessRequestResponseDto> {
    return this.service.cancel(user, id);
  }
}
