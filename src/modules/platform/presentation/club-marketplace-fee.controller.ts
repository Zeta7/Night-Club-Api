import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { MarketplaceFeeService } from '../application/marketplace-fee.service';
import { ClubMarketplaceFeeResponseDto } from './platform.response.dto';

@ApiTags('Marketplace fees')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/marketplace-fee')
export class ClubMarketplaceFeeController {
  constructor(private readonly fees: MarketplaceFeeService) {}

  @ApiResponse({ status: 200, type: ClubMarketplaceFeeResponseDto })
  @Get()
  @ApiOperation({ summary: 'Consultar la comisión efectiva del negocio (ADMIN, SUPER_ADMIN)' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') clubId: string,
  ): Promise<ClubMarketplaceFeeResponseDto> {
    return this.fees.effectiveFor(user, clubId);
  }
}
