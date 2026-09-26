import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ type: 'string' })
  status!: string;

  @ApiProperty({ type: 'string' })
  service!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  timestamp!: string;
}
