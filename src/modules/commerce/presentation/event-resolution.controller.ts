import { Body, Controller, Get, Param, Post, UseGuards, BadRequestException } from '@nestjs/common';
import {
  IsIn,
  IsUUID,
  IsInt,
  Min,
  IsString,
  MinLength,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { CommerceItemType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../identity/presentation/guards/access-token.guard';
import { AuthenticatedUser, CurrentUser } from '../../identity/presentation/current-user';
import { EventReplacementService } from '../application/event-replacement.service';
import { EventRefundWorker } from '../application/event-refund-worker.service';

class ReplacementMappingDto {
  @ApiProperty({ enum: ['TICKET', 'PROMOTION'] })
  @IsIn(['TICKET', 'PROMOTION'])
  itemType!: CommerceItemType;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sourceItemId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetItemId!: string;
}
class AcceptReplacementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cancellationId!: string;
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startsAt!: string;
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  endsAt!: string;
}
class ReviewJobDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  decision!: string;
  @ApiProperty({ minimum: 1, description: 'Importe exacto a devolver, en céntimos.' })
  @IsInt()
  @Min(1)
  amountCents!: number;
  @ApiProperty({ minLength: 5, maxLength: 1000 })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

@UseGuards(AccessTokenGuard)
@Controller()
export class EventResolutionController {
  constructor(
    private readonly replacements: EventReplacementService,
    private readonly refunds: EventRefundWorker,
  ) {}
  @Get('events/admin/refund-jobs')
  jobs(@CurrentUser() user: AuthenticatedUser) {
    return this.refunds.list(user);
  }
  @Get('clubs/:clubId/events/:eventId/refund-jobs')
  businessJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') club: string,
    @Param('eventId') event: string,
  ) {
    return this.refunds.list(user, club, event);
  }
  @Post('events/admin/refund-jobs/:id/review')
  reviewJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: ReviewJobDto,
  ) {
    return this.refunds.review(
      user,
      id,
      input.amountCents,
      input.reason,
      input.decision === 'APPROVE',
    );
  }
  @Post('events/admin/unallocated-refunds/:id/process')
  processUnallocated(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: ReviewJobDto,
  ) {
    if (input.decision !== 'APPROVE')
      throw new BadRequestException('Se requiere aprobación explícita.');
    return this.refunds.processUnallocated(user, id, input.amountCents, input.reason);
  }
  @Get('clubs/:clubId/events/:eventId/replacement-options')
  options(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') club: string,
    @Param('eventId') event: string,
  ) {
    return this.replacements.options(user, club, event);
  }
  @Post('clubs/:clubId/events/:eventId/replacement-mappings')
  configure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clubId') club: string,
    @Param('eventId') event: string,
    @Body() input: ReplacementMappingDto,
  ) {
    return this.replacements.configure(
      user,
      club,
      event,
      input.itemType,
      input.sourceItemId,
      input.targetItemId,
    );
  }
  @Post('events/me/purchases/:id/accept-replacement')
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: AcceptReplacementDto,
  ) {
    return this.replacements.accept(user, id, input.cancellationId, input.startsAt, input.endsAt);
  }
}
