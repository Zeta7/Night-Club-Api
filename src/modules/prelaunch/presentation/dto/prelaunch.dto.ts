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
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsISO8601,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsInteger, OptionalField } from '../../../../shared/presentation/dto-fields';

const optionalTrimmed = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined));

export class PreLaunchAttributionDto {
  @OptionalField({ nullable: true, type: String, maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @optionalTrimmed()
  utmSource?: string | null;
  @OptionalField({ nullable: true, type: String, maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @optionalTrimmed()
  utmMedium?: string | null;
  @OptionalField({ nullable: true, type: String, maxLength: 160 })
  @IsString()
  @MaxLength(160)
  @optionalTrimmed()
  utmCampaign?: string | null;
  @OptionalField({ nullable: true, type: String, maxLength: 80 })
  @IsString()
  @MaxLength(80)
  @optionalTrimmed()
  referralCode?: string | null;
  @OptionalField({ nullable: true, type: String, maxLength: 80 })
  @IsString()
  @MaxLength(80)
  @optionalTrimmed()
  sourceBusinessSlug?: string | null;
  @OptionalField({ nullable: true, type: String, maxLength: 80 })
  @IsString()
  @MaxLength(80)
  @optionalTrimmed()
  influencerCode?: string | null;
  @OptionalField({ nullable: true, type: String, maxLength: 300 })
  @IsString()
  @MaxLength(300)
  @optionalTrimmed()
  landingOrigin?: string | null;
  @OptionalField({ nullable: true, type: String, maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @optionalTrimmed()
  sessionId?: string | null;
}

export class StartPreLaunchRegistrationDto extends PreLaunchAttributionDto {
  @ApiProperty({ maxLength: 120 }) @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty() @IsEmail() @MaxLength(200) email!: string;
  @ApiProperty({ example: '987654321' }) @IsString() @Matches(/^9\d{8}$/) phone!: string;
  @Type(() => Number) @IsInteger() @Min(1) departmentId!: number;
  @Type(() => Number) @IsInteger() @Min(1) provinceId!: number;
  @Type(() => Number) @IsInteger() @Min(1) districtId!: number;
  @ApiProperty({ example: '130111' }) @IsString() @Matches(/^\d{6}$/) ubigeoCode!: string;
  @OptionalField({
    type: [String],
    example: ['discotecas', 'eventos'],
    description: 'Se completa opcionalmente después de verificar el celular.',
  })
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  interests?: string[];
  @OptionalField({
    type: 'array',
    items: { type: 'integer' },
    maxItems: 3,
    description: 'Distritos donde la persona suele salir.',
  })
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @Type(() => Number)
  @IsInteger({ each: true })
  @Min(1, { each: true })
  nightlifeDistrictIds?: number[];
  @OptionalField({
    type: [String],
    maxItems: 5,
    description: 'Establecimientos que la persona quiere ver en Beerry.',
  })
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(120, { each: true })
  suggestedVenues?: string[];
  @ApiProperty() @IsBoolean() isAdultDeclared!: boolean;
  @ApiProperty() @IsBoolean() privacyAccepted!: boolean;
  @ApiProperty({ example: '2026-10-01' }) @IsString() @MaxLength(40) privacyPolicyVersion!: string;
  @ApiProperty() @IsBoolean() marketingConsent!: boolean;
  @OptionalField({ description: 'Token de Cloudflare Turnstile.' })
  @IsString()
  @MaxLength(3000)
  turnstileToken?: string;
}

export class UpdatePreLaunchPreferencesDto {
  @ApiProperty() @IsString() @MinLength(32) @MaxLength(200) accessToken!: string;
  @OptionalField({ type: [String], example: ['discotecas', 'eventos'] })
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  interests?: string[];
  @OptionalField({ type: 'array', items: { type: 'integer' }, maxItems: 3 })
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @Type(() => Number)
  @IsInteger({ each: true })
  @Min(1, { each: true })
  nightlifeDistrictIds?: number[];
  @OptionalField({ type: [String], maxItems: 5 })
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(120, { each: true })
  suggestedVenues?: string[];
  @ApiProperty() @IsBoolean() marketingConsent!: boolean;
}

export class CheckPreLaunchPhoneDto {
  @ApiProperty({ example: '987654321' }) @IsString() @Matches(/^9\d{8}$/) phone!: string;
  @OptionalField() @IsString() @MaxLength(3000) turnstileToken?: string;
  @OptionalField() @IsString() @MaxLength(80) sessionId?: string;
}

export class RecoverPreLaunchAccessDto {
  @ApiProperty({ example: '987654321' }) @IsString() @Matches(/^9\d{8}$/) phone!: string;
  @OptionalField() @IsString() @MaxLength(3000) turnstileToken?: string;
  @OptionalField() @IsString() @MaxLength(80) sessionId?: string;
}

export class RequestPreLaunchOtpDto {
  @ApiProperty() @IsString() @MinLength(32) @MaxLength(200) accessToken!: string;
  @OptionalField() @IsString() @MaxLength(3000) turnstileToken?: string;
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
  @Type(() => Number) @IsInteger() @Min(1) departmentId!: number;
  @Type(() => Number) @IsInteger() @Min(1) provinceId!: number;
  @Type(() => Number) @IsInteger() @Min(1) districtId!: number;
  @ApiProperty() @IsString() @Matches(/^\d{6}$/) ubigeoCode!: string;
  @ApiProperty() @IsString() @MinLength(4) @MaxLength(240) address!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) contactName!: string;
  @ApiProperty() @IsString() @Matches(/^9\d{8}$/) phone!: string;
  @ApiProperty() @IsEmail() @MaxLength(200) email!: string;
  @OptionalField() @IsString() @MaxLength(500) socialNetworks?: string;
  @OptionalField() @IsString() @MaxLength(1200) comment?: string;
  @ApiProperty() @IsBoolean() privacyAccepted!: boolean;
  @ApiProperty({ example: '2026-10-01' }) @IsString() @MaxLength(40) privacyPolicyVersion!: string;
  @OptionalField() @IsString() @MaxLength(3000) turnstileToken?: string;
  @OptionalField() @IsString() @MaxLength(120) sessionId?: string;
}

export class TrackPreLaunchEventDto extends PreLaunchAttributionDto {
  @ApiProperty({ enum: PreLaunchEventType }) @IsEnum(PreLaunchEventType) type!: PreLaunchEventType;
  @OptionalField()
  @IsString()
  @MinLength(32)
  @MaxLength(200)
  accessToken?: string;
  @OptionalField() @IsString() @MaxLength(80) marketSlug?: string;
  @OptionalField() @IsString() @MaxLength(80) partnerSlug?: string;
}

export class AdminPreLaunchQueryDto {
  @OptionalField() @IsString() @MaxLength(120) query?: string;
  @OptionalField() @IsString() @MaxLength(80) marketId?: string;
  @OptionalField() @IsString() @MaxLength(6) ubigeoCode?: string;
  @OptionalField({ type: String, enum: ['REAL', 'SYNTHETIC'] })
  @IsIn(['REAL', 'SYNTHETIC'])
  source?: 'REAL' | 'SYNTHETIC';
  @OptionalField({ type: 'integer', default: 1 }) @Type(() => Number) @IsInteger() @Min(1) page = 1;
  @OptionalField({ type: 'integer', default: 30 })
  @Type(() => Number)
  @IsInteger()
  @Min(1)
  @Max(100)
  pageSize = 30;
}

export class LaunchMarketUbigeoDto {
  @ApiProperty({ type: 'integer' }) departmentId!: number;
  @ApiPropertyOptional({ type: 'integer' }) provinceId?: number;
  @ApiPropertyOptional({ type: 'integer' }) districtId?: number;
  @ApiPropertyOptional({ type: 'string' }) ubigeoCode?: string;
}

export class UpsertLaunchMarketDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @ApiProperty() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100) slug!: string;
  @Type(() => Number) @IsInteger() @Min(1) goal!: number;
  @ApiProperty({ enum: LaunchMarketStatus })
  @IsEnum(LaunchMarketStatus)
  status!: LaunchMarketStatus;
  @OptionalField({ format: 'date-time' }) @IsISO8601() launchAt?: string;
  @Type(() => Number) @IsInteger() @Min(0) publicOrder!: number;
  @ApiProperty() @IsBoolean() isPublic!: boolean;
  @Type(() => Number) @IsInteger() @Min(0) benefitsPrepared!: number;
  @Type(() => Number) @IsInteger() @Min(0) eventsPrepared!: number;
  @OptionalField({ type: () => [LaunchMarketUbigeoDto] })
  @IsArray()
  ubigeos?: Array<{
    departmentId: number;
    provinceId?: number;
    districtId?: number;
    ubigeoCode?: string;
  }>;
}

export class UpdateBusinessApplicationStatusDto {
  @ApiProperty({ enum: BusinessPreLaunchApplicationStatus })
  @IsEnum(BusinessPreLaunchApplicationStatus)
  status!: BusinessPreLaunchApplicationStatus;
}

export class PublishBusinessPreLaunchApplicationDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) marketId!: string;
  @OptionalField({ maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  publicName?: string;
  @OptionalField()
  @IsUrl({ require_protocol: true })
  @MaxLength(600)
  logoUrl?: string;
  @OptionalField()
  @IsUrl({ require_protocol: true })
  @MaxLength(600)
  imageUrl?: string;
  @ApiProperty({ type: 'integer', default: 0 })
  @Type(() => Number)
  @IsInteger()
  @Min(0)
  benefitCount = 0;
  @ApiProperty({ default: true }) @IsBoolean() isPublic = true;
  @ApiProperty({ type: 'integer', default: 0 })
  @Type(() => Number)
  @IsInteger()
  @Min(0)
  publicOrder = 0;
}

export class UpsertPreLaunchPartnerDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) marketId!: string;
  @ApiProperty() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100) slug!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) category!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) districtName!: string;
  @OptionalField()
  @IsUrl({ require_protocol: true })
  @MaxLength(600)
  logoUrl?: string;
  @OptionalField()
  @IsUrl({ require_protocol: true })
  @MaxLength(600)
  imageUrl?: string;
  @Type(() => Number) @IsInteger() @Min(0) benefitCount!: number;
  @ApiProperty({ enum: PreLaunchPartnerStatus })
  @IsEnum(PreLaunchPartnerStatus)
  status!: PreLaunchPartnerStatus;
  @ApiProperty() @IsBoolean() isPublic!: boolean;
  @Type(() => Number) @IsInteger() @Min(0) publicOrder!: number;
}
