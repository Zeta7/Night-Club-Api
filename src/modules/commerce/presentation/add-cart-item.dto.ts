import { IsInteger } from '../../../shared/presentation/dto-fields';
import { Type } from 'class-transformer';
import { IsEnum, IsUUID, Max, Min } from 'class-validator';
import { CommerceItemType } from '@prisma/client';

export class AddCartItemDto {
  @IsUUID()
  id!: string;

  @IsEnum(CommerceItemType)
  type!: CommerceItemType;

  @Type(() => Number)
  @IsInteger()
  @Min(1)
  @Max(20)
  quantity!: number;
}
