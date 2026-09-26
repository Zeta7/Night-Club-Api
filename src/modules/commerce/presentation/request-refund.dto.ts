import { IsInteger, OptionalField } from '../../../shared/presentation/dto-fields';
import { IsString, MaxLength, Min, MinLength } from 'class-validator';

export class RequestRefundDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;

  @OptionalField()
  @IsInteger()
  @Min(1)
  amountCents?: number;
}
