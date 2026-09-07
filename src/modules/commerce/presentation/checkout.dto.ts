import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class CheckoutDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedTotalCents!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  promotionalCreditCents?: number;

  @IsOptional()
  @IsIn(['MERCADO_PAGO', 'BEERRY_WALLET'])
  paymentMethod?: 'MERCADO_PAGO' | 'BEERRY_WALLET';
}
