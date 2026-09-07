import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessAccessService } from '../application/business-access.service';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { CreateBusinessAccessRequestDto } from './dto/create-business-access-request.dto';

@ApiTags('Business access requests')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('business-access-requests')
export class BusinessAccessController {
  constructor(private readonly service: BusinessAccessService) {}

  @Post()
  @ApiOperation({ summary: 'Solicitar acceso para registrar o administrar un negocio' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateBusinessAccessRequestDto) {
    return this.service.create(user, body);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Consultar mis solicitudes comerciales' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.mine(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar una solicitud propia' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getMine(user.id, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancelar una solicitud propia pendiente' })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.cancel(user, id);
  }
}
