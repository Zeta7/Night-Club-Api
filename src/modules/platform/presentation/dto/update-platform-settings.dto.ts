import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiProperty({
    description:
      'Configuracion global parcial. La publicidad se configura dentro de advertisingSettings.',
    example: {
      commissionPercentage: 10,
      supportPhone: '+51999999999',
      withdrawalsEnabled: true,
      advertisingSettings: {
        featuredBusinessDailyPriceCents: 1000,
        featuredEventDailyPriceCents: 300,
      },
    },
  })
  @IsObject({ message: 'La configuracion debe ser un objeto JSON.' })
  settings!: Record<string, unknown>;
}
