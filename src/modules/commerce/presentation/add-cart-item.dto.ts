import { ApiProperty } from '@nestjs/swagger';
import { CommerceItemType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsUUID, Max, Min } from 'class-validator';
import { IsInteger } from '../../../shared/presentation/dto-fields';

export class AddCartItemDto {
  @IsUUID()
  id!: string;

  @ApiProperty({ enum: CommerceItemType, enumName: 'CommerceItemType' })
  @IsEnum(CommerceItemType)
  type!: CommerceItemType;

  @Type(() => Number)
  @IsInteger()
  @Min(1)
  @Max(20)
  quantity!: number;
}
