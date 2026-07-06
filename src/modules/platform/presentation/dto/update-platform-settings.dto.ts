import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiProperty({
    description: 'Configuracion global de la plataforma en formato JSON.',
    example: {
      commissionPercentage: 10,
      supportPhone: '+51999999999',
      withdrawalsEnabled: true,
    },
  })
  @IsObject({ message: 'La configuracion debe ser un objeto JSON.' })
  settings!: Record<string, unknown>;
}
