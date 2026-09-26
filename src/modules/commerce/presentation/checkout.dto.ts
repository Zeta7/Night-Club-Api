import { IsInteger, OptionalField } from '../../../shared/presentation/dto-fields';
import { Type } from 'class-transformer';
import { IsIn, Min } from 'class-validator';

export class CheckoutDto {
  @Type(() => Number)
  @IsInteger()
  @Min(0)
  expectedTotalCents!: number;

  @OptionalField()
  @Type(() => Number)
  @IsInteger()
  @Min(0)
  promotionalCreditCents?: number;

  @OptionalField()
  @IsIn(['MERCADO_PAGO', 'BEERRY_WALLET'])
  paymentMethod?: 'MERCADO_PAGO' | 'BEERRY_WALLET';
}
