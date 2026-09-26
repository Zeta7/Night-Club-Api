import { IsInteger } from '../../../shared/presentation/dto-fields';
import { Type } from 'class-transformer';
import { IsString, Min, MinLength } from 'class-validator';

export class WalletTopUpDto {
  @Type(() => Number)
  @IsInteger()
  @Min(200)
  amountCents!: number;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}
