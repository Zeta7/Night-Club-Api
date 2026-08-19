import { Type } from 'class-transformer';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class WalletTopUpDto {
  @Type(() => Number)
  @IsInt()
  @Min(200)
  amountCents!: number;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}
