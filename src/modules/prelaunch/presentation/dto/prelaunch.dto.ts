import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BusinessPreLaunchApplicationStatus,
  LaunchMarketStatus,
  PreLaunchEventType,
  PreLaunchPartnerStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const optionalTrimmed = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined));

export class PreLaunchAttributionDto {
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @MaxLength(120) @optionalTrimmed() utmSource?: string;
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @MaxLength(120) @optionalTrimmed() utmMedium?: string;
  @ApiPropertyOptional({ maxLength: 160 }) @IsOptional() @IsString() @MaxLength(160) @optionalTrimmed() utmCampaign?: string;
  @ApiPropertyOptional({ maxLength: 80 }) @IsOptional() @IsString() @MaxLength(80) @optionalTrimmed() referralCode?: string;
  @ApiPropertyOptional({ maxLength: 80 }) @IsOptional() @IsString() @MaxLength(80) @optionalTrimmed() sourceBusinessSlug?: string;
  @ApiPropertyOptional({ maxLength: 80 }) @IsOptional() @IsString() @MaxLength(80) @optionalTrimmed() influencerCode?: string;
  @ApiPropertyOptional({ maxLength: 300 }) @IsOptional() @IsString() @MaxLength(300) @optionalTrimmed() landingOrigin?: string;
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @MaxLength(120) @optionalTrimmed() sessionId?: string;
}

export class StartPreLaunchRegistrationDto extends PreLaunchAttributionDto {
  @ApiProperty({ maxLength: 120 }) @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty() @IsEmail() @MaxLength(200) email!: string;
  @ApiProperty({ example: '987654321' }) @IsString() @Matches(/^9\d{8}$/) phone!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) departmentId!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) provinceId!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) districtId!: number;
  @ApiProperty({ example: '130111' }) @IsString() @Matches(/^\d{6}$/) ubigeoCode!: string;
  @ApiProperty({ isArray: true, example: ['discotecas', 'eventos'] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsString({ each: true }) interests!: string[];
  @ApiProperty() @IsBoolean() isAdultDeclared!: boolean;
  @ApiProperty() @IsBoolean() privacyAccepted!: boolean;
  @ApiProperty({ example: '2026-09-25' }) @IsString() @MaxLength(40) privacyPolicyVersion!: string;
  @ApiProperty() @IsBoolean() marketingConsent!: boolean;
  @ApiPropertyOptional({ description: 'Token de Cloudflare Turnstile.' }) @IsOptional() @IsString() @MaxLength(3000) turnstileToken?: string;
}

export class RequestPreLaunchOtpDto {
  @ApiProperty() @IsString() @MinLength(32) @MaxLength(200) accessToken!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) turnstileToken?: string;
}

export class VerifyPreLaunchOtpDto {
  @ApiProperty() @IsString() @MinLength(32) @MaxLength(200) accessToken!: string;
  @ApiProperty({ example: '123456' }) @IsString() @Matches(/^\d{6}$/) code!: string;
}

export class PreLaunchAccessDto {
  @ApiProperty() @IsString() @MinLength(32) @MaxLength(200) accessToken!: string;
}

export class CreateBusinessPreLaunchApplicationDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) businessName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) type!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) departmentId!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) provinceId!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) districtId!: number;
  @ApiProperty() @IsString() @Matches(/^\d{6}$/) ubigeoCode!: string;
  @ApiProperty() @IsString() @MinLength(4) @MaxLength(240) address!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) contactName!: string;
  @ApiProperty() @IsString() @Matches(/^9\d{8}$/) phone!: string;
  @ApiProperty() @IsEmail() @MaxLength(200) email!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) socialNetworks?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1200) comment?: string;
  @ApiProperty() @IsBoolean() privacyAccepted!: boolean;
  @ApiProperty({ example: '2026-09-25' }) @IsString() @MaxLength(40) privacyPolicyVersion!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) turnstileToken?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) sessionId?: string;
}

export class TrackPreLaunchEventDto extends PreLaunchAttributionDto {
  @ApiProperty({ enum: PreLaunchEventType }) @IsEnum(PreLaunchEventType) type!: PreLaunchEventType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(32) @MaxLength(200) accessToken?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) marketSlug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) partnerSlug?: string;
}

export class AdminPreLaunchQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) query?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) marketId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(6) ubigeoCode?: string;
  @ApiPropertyOptional({ enum: ['REAL', 'SYNTHETIC'] }) @IsOptional() @IsIn(['REAL', 'SYNTHETIC']) source?: 'REAL' | 'SYNTHETIC';
  @ApiPropertyOptional({ default: 1 }) @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 30 }) @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 30;
}

export class UpsertLaunchMarketDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @ApiProperty() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100) slug!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) goal!: number;
  @ApiProperty({ enum: LaunchMarketStatus }) @IsEnum(LaunchMarketStatus) status!: LaunchMarketStatus;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() launchAt?: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) publicOrder!: number;
  @ApiProperty() @IsBoolean() isPublic!: boolean;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) benefitsPrepared!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) eventsPrepared!: number;
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() ubigeos?: Array<{ departmentId: number; provinceId?: number; districtId?: number; ubigeoCode?: string }>;
}

export class UpdateBusinessApplicationStatusDto {
  @ApiProperty({ enum: BusinessPreLaunchApplicationStatus })
  @IsEnum(BusinessPreLaunchApplicationStatus) status!: BusinessPreLaunchApplicationStatus;
}

export class PublishBusinessPreLaunchApplicationDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) marketId!: string;
  @ApiPropertyOptional({ maxLength: 160 }) @IsOptional() @IsString() @MinLength(2) @MaxLength(160) publicName?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(600) logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(600) imageUrl?: string;
  @ApiProperty({ default: 0 }) @Type(() => Number) @IsInt() @Min(0) benefitCount = 0;
  @ApiProperty({ default: true }) @IsBoolean() isPublic = true;
  @ApiProperty({ default: 0 }) @Type(() => Number) @IsInt() @Min(0) publicOrder = 0;
}

export class UpsertPreLaunchPartnerDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) marketId!: string;
  @ApiProperty() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100) slug!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) category!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) districtName!: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(600) logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(600) imageUrl?: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) benefitCount!: number;
  @ApiProperty({ enum: PreLaunchPartnerStatus }) @IsEnum(PreLaunchPartnerStatus) status!: PreLaunchPartnerStatus;
  @ApiProperty() @IsBoolean() isPublic!: boolean;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) publicOrder!: number;
}
