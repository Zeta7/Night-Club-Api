import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { SuperAdminGuard } from '../../platform/presentation/guards/super-admin.guard';
import { AuditService } from '../application/audit.service';
import { AuditQueryDto, UpdateAuditPolicyDto } from './audit.dto';
import {
  AuditPolicyResponseDto,
  AuditSearchResponseDto,
  AuditVerificationResponseDto,
} from './audit.response.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, SuperAdminGuard)
@Controller('platform/audit-logs')
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @ApiOperation({ summary: 'Buscar registros de auditoría (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: AuditSearchResponseDto })
  @Get()
  search(@Query() query: AuditQueryDto): Promise<AuditSearchResponseDto> {
    return this.service.search(query);
  }
  @ApiOperation({ summary: 'Obtener la política de auditoría (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: AuditPolicyResponseDto })
  @Get('policy')
  policy(): Promise<AuditPolicyResponseDto> {
    return this.service.getPolicy();
  }
  @ApiOperation({ summary: 'Actualizar la política de retención de auditoría (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: AuditPolicyResponseDto })
  @Patch('policy')
  updatePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateAuditPolicyDto,
  ): Promise<AuditPolicyResponseDto> {
    return this.service.updatePolicy(user.id, user.role, body.retentionDays);
  }
  @ApiOperation({ summary: 'Verificar la integridad de auditoría (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, type: AuditVerificationResponseDto })
  @Get('verify')
  verify(@Query('clubId') clubId?: string): Promise<AuditVerificationResponseDto> {
    return this.service.verifyIntegrity(clubId);
  }
}
