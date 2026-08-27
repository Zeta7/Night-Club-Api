import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { SuperAdminGuard } from '../../platform/presentation/guards/super-admin.guard';
import { AuditService } from '../application/audit.service';
import { AuditQueryDto, UpdateAuditPolicyDto } from './audit.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, SuperAdminGuard)
@Controller('platform/audit-logs')
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get() search(@Query() query: AuditQueryDto) { return this.service.search(query); }
  @Get('policy') policy() { return this.service.getPolicy(); }
  @Patch('policy') updatePolicy(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateAuditPolicyDto) { return this.service.updatePolicy(user.id, user.role, body.retentionDays); }
  @Get('verify') verify(@Query('clubId') clubId?: string) { return this.service.verifyIntegrity(clubId); }
}
