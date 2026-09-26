import { ApiProperty } from '@nestjs/swagger';
import { SellerConnectionStatus } from '@prisma/client';

export class WalletAcceptanceResponseDto {
  @ApiProperty({ type: 'boolean' })
  enabled!: boolean;
}

export class SellerConnectionResponseDto {
  @ApiProperty({ type: 'string' })
  provider!: string;

  @ApiProperty({ enum: SellerConnectionStatus, enumName: 'SellerConnectionStatus' })
  status!: SellerConnectionStatus;

  @ApiProperty({ type: 'string', nullable: true })
  accountHint!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  connectedAt!: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  tokenExpiresAt!: Date | null;

  @ApiProperty({ type: 'string', nullable: true })
  lastError!: string | null;
}

export class SellerConnectionAuthorizationResponseDto {
  @ApiProperty({ type: 'string' })
  provider!: string;

  @ApiProperty({ type: 'string' })
  authorizationUrl!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  expiresAt!: Date;
}
