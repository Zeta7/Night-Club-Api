import { IsInteger, OptionalField } from '../../../../shared/presentation/dto-fields';
import { IsBoolean, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RegisterCapacityExitDto {
  @OptionalField() @IsUUID() ticketId?: string;
  @OptionalField() @IsString() @MaxLength(200) idempotencyKey?: string;
}

export class CorrectCapacityDto {
  @IsInteger() @Min(0) @Max(1000000) targetCount!: number;
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
  @OptionalField() @IsString() @MaxLength(200) idempotencyKey?: string;
}

export class UpdateCapacitySettingsDto {
  @IsBoolean() reentryAllowed!: boolean;
}
