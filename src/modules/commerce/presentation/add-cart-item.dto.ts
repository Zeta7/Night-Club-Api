import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsUUID, Max, Min } from 'class-validator';
import { CommerceItemType } from '@prisma/client';

export class AddCartItemDto {
  @IsUUID()
  id!: string;

  @IsEnum(CommerceItemType)
  type!: CommerceItemType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}
