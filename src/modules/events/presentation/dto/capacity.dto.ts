import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RegisterCapacityExitDto {
  @IsOptional() @IsUUID() ticketId?: string;
  @IsOptional() @IsString() @MaxLength(200) idempotencyKey?: string;
}

export class CorrectCapacityDto {
  @IsInt() @Min(0) @Max(1000000) targetCount!: number;
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
  @IsOptional() @IsString() @MaxLength(200) idempotencyKey?: string;
}

export class UpdateCapacitySettingsDto {
  @IsBoolean() reentryAllowed!: boolean;
}
