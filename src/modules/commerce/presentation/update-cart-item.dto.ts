import { IsInteger } from '../../../shared/presentation/dto-fields';
import { Type } from 'class-transformer';
import { Max, Min } from 'class-validator';

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsInteger()
  @Min(1)
  @Max(20)
  quantity!: number;
}
