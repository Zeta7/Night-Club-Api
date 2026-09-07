import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarketplaceFeeService } from '../application/marketplace-fee.service';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';

@ApiTags('Marketplace fees')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('clubs/:clubId/marketplace-fee')
export class ClubMarketplaceFeeController {
  constructor(private readonly fees: MarketplaceFeeService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar la comisión efectiva del negocio (solo lectura)' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('clubId') clubId: string) {
    return this.fees.effectiveFor(user, clubId);
  }
}
