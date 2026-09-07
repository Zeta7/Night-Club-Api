import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateMarketplaceFeeDto {
  @ApiProperty({
    description: 'Comisión en puntos base. 100 equivale a 1%.',
    minimum: 0,
    maximum: 10000,
  })
  @IsInt()
  @Min(0)
  @Max(10000)
  feeBps!: number;

  @ApiProperty({ description: 'Motivo auditable del cambio.', maxLength: 500 })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}

export class RemoveMarketplaceFeeOverrideDto {
  @ApiProperty({ description: 'Motivo auditable del cambio.', maxLength: 500 })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}
