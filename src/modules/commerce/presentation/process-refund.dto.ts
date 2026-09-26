import { IsInteger, OptionalField } from '../../../shared/presentation/dto-fields';
import { IsString, MaxLength, Min } from 'class-validator';

export class ProcessRefundDto {
  @OptionalField()
  @IsInteger()
  @Min(1)
  approvedAmountCents?: number;

  @OptionalField()
  @IsString()
  @MaxLength(500)
  resolutionNote?: string;
}
