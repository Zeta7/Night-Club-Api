import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewBusinessAccessRequestDto {
  @ApiProperty({ description: 'Motivo auditable de la decisión.', maxLength: 1000 })
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  comment!: string;
}
