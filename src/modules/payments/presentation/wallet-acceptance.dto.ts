import { IsBoolean } from 'class-validator';

export class WalletAcceptanceDto {
  @IsBoolean()
  enabled!: boolean;
}
