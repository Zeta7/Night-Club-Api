import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiProperty({
    description:
      'Configuracion global parcial. Para promociones admite featuredBusinessPriceCents, featuredEventPriceCents y featuredCampaignDurationDays.',
    example: {
      commissionPercentage: 10,
      supportPhone: '+51999999999',
      withdrawalsEnabled: true,
      featuredBusinessPriceCents: 5000,
      featuredEventPriceCents: 3000,
      featuredCampaignDurationDays: 7,
    },
  })
  @IsObject({ message: 'La configuracion debe ser un objeto JSON.' })
  settings!: Record<string, unknown>;
}
