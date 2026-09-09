import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CancelEventDto {
  @IsIn(['REFUND_REQUESTED', 'REFUND_DECLINED', 'REPLACEMENT'])
  mode!: 'REFUND_REQUESTED' | 'REFUND_DECLINED' | 'REPLACEMENT';

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsUUID()
  replacementEventId?: string;
}

export class ReviewEventCancellationDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}
