import { ApiProperty } from '@nestjs/swagger';
import { OptionalField } from '../../../../shared/presentation/dto-fields';
import { IsDateString, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AuthorizeWorkerDeviceDto {
  @IsString() @MinLength(8) @MaxLength(200) fingerprint!: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsString() @MinLength(2) @MaxLength(30) platform!: string;
}

export class StartWorkerShiftDto {
  @OptionalField() @IsUUID() eventId?: string;
  @IsString() @MinLength(8) @MaxLength(200) deviceFingerprint!: string;
}

export class CloseWorkerShiftDto {
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}

export class SyncWorkerShiftDto {
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString() lastClientActivityAt!: string;
}
