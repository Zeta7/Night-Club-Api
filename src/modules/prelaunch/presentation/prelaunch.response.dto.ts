import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LaunchMarketStatus, PreLaunchLeadStatus } from '@prisma/client';

export class PreLaunchUbigeoDepartmentDto {
  @ApiProperty({ type: 'integer' }) id!: number;
  @ApiProperty({ type: 'string' }) name!: string;
  @ApiProperty({ type: 'string' }) ubigeo!: string;
}

export class PreLaunchUbigeoProvinceDto extends PreLaunchUbigeoDepartmentDto {
  @ApiProperty({ type: 'integer' }) departmentId!: number;
}

export class PreLaunchUbigeoDistrictDto extends PreLaunchUbigeoProvinceDto {
  @ApiProperty({ type: 'integer' }) provinceId!: number;
}

export class PreLaunchLocationsResponseDto {
  @ApiProperty({ type: () => [PreLaunchUbigeoDepartmentDto] })
  departments!: PreLaunchUbigeoDepartmentDto[];

  @ApiProperty({ type: () => [PreLaunchUbigeoProvinceDto] })
  provinces!: PreLaunchUbigeoProvinceDto[];

  @ApiProperty({ type: () => [PreLaunchUbigeoDistrictDto] })
  districts!: PreLaunchUbigeoDistrictDto[];
}

export class PreLaunchVenueOptionDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) name!: string;
  @ApiProperty({ type: 'string' }) category!: string;
  @ApiProperty({ type: 'string' }) districtName!: string;
}

export class PreLaunchVenueOptionsResponseDto {
  @ApiProperty({ type: () => [PreLaunchVenueOptionDto] })
  items!: PreLaunchVenueOptionDto[];
}

export class PreLaunchCityDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) name!: string;
  @ApiProperty({ type: 'string' }) departmentName!: string;
  @ApiProperty({ type: 'string', nullable: true }) marketSlug!: string | null;
  @ApiProperty({ type: 'integer' }) goal!: number;
  @ApiProperty({ enum: LaunchMarketStatus, enumName: 'LaunchMarketStatus' })
  status!: LaunchMarketStatus;
  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  launchAt!: Date | null;
  @ApiProperty({ type: 'integer' }) verifiedCount!: number;
  @ApiProperty({ type: 'integer' }) remaining!: number;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 100 }) progress!: number;
}

export class PreLaunchPartnerSummaryDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) slug!: string;
  @ApiProperty({ type: 'string' }) name!: string;
  @ApiProperty({ type: 'string' }) category!: string;
  @ApiProperty({ type: 'string' }) districtName!: string;
  @ApiProperty({ type: 'string', nullable: true }) logoUrl!: string | null;
  @ApiProperty({ type: 'string', nullable: true }) imageUrl!: string | null;
  @ApiProperty({ type: 'integer' }) benefitCount!: number;
}

export class PreLaunchMarketSummaryDto extends PreLaunchCityDto {
  @ApiProperty({ type: 'string' }) slug!: string;
  @ApiProperty({ type: 'integer' }) partnerCount!: number;
  @ApiProperty({ type: 'integer' }) benefitCount!: number;
  @ApiProperty({ type: () => [PreLaunchPartnerSummaryDto] })
  partners!: PreLaunchPartnerSummaryDto[];
}

export class PreLaunchOverviewResponseDto {
  @ApiProperty({ type: 'boolean' }) demoMode!: boolean;
  @ApiProperty({ type: 'integer' }) verifiedTotal!: number;
  @ApiProperty({ type: () => [PreLaunchCityDto] }) cities!: PreLaunchCityDto[];
  @ApiProperty({ type: () => [PreLaunchMarketSummaryDto] })
  markets!: PreLaunchMarketSummaryDto[];
}

export class PreLaunchPhoneStateResponseDto {
  @ApiProperty({ enum: ['NEW', 'BLOCKED', 'PENDING_OTP', 'REGISTERED'] })
  state!: 'NEW' | 'BLOCKED' | 'PENDING_OTP' | 'REGISTERED';
  @ApiProperty({ type: 'string' }) maskedPhone!: string;
  @ApiPropertyOptional({ type: 'boolean' }) existingRegistration?: boolean;
  @ApiPropertyOptional({ type: 'string' }) message?: string;
  @ApiPropertyOptional({ type: 'string', format: 'date-time' }) registeredAt?: string;
  @ApiPropertyOptional({ type: 'string' }) referralCode?: string;
  @ApiPropertyOptional({ type: 'string' }) referralPath?: string;
}

export class PreLaunchOtpChallengeResponseDto {
  @ApiProperty({ type: 'string' }) message!: string;
  @ApiProperty({ type: 'string' }) accessToken!: string;
  @ApiProperty({ type: 'string' }) maskedPhone!: string;
  @ApiProperty({ type: 'integer' }) expiresInSeconds!: number;
  @ApiProperty({ type: 'boolean' }) existingRegistration!: boolean;
}

export class PreLaunchMessageResponseDto {
  @ApiProperty({ type: 'string' }) message!: string;
  @ApiPropertyOptional({ type: 'integer' }) expiresInSeconds?: number;
}

export class PreLaunchLocationDto {
  @ApiProperty({ type: 'string' }) department!: string;
  @ApiProperty({ type: 'string' }) province!: string;
  @ApiProperty({ type: 'string' }) district!: string;
}

export class PreLaunchPreferencesDto {
  @ApiProperty({ type: [String] }) interests!: string[];
  @ApiProperty({ type: [Number] }) nightlifeDistrictIds!: number[];
  @ApiProperty({ type: [String] }) nightlifeDistrictNames!: string[];
  @ApiProperty({ type: [String] }) suggestedVenues!: string[];
  @ApiProperty({ type: 'boolean' }) marketingConsent!: boolean;
}

export class PreLaunchAccessMarketDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) name!: string;
  @ApiProperty({ type: 'string' }) slug!: string;
  @ApiProperty({ type: 'integer' }) goal!: number;
  @ApiProperty({ enum: LaunchMarketStatus, enumName: 'LaunchMarketStatus' })
  status!: LaunchMarketStatus;
  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  launchAt!: Date | null;
  @ApiProperty({ type: 'integer' }) verifiedCount!: number;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 100 }) progress!: number;
}

export class PreLaunchAccessStatusResponseDto {
  @ApiProperty({ type: 'boolean' }) verified!: boolean;
  @ApiProperty({ type: 'boolean' }) returningUser!: boolean;
  @ApiPropertyOptional({ enum: PreLaunchLeadStatus, enumName: 'PreLaunchLeadStatus' })
  status?: PreLaunchLeadStatus;
  @ApiPropertyOptional({ type: 'string' }) name?: string;
  @ApiPropertyOptional({ type: 'integer' }) position?: number;
  @ApiPropertyOptional({ type: 'string' }) referralCode?: string;
  @ApiPropertyOptional({ type: 'string' }) referralPath?: string;
  @ApiPropertyOptional({ type: 'integer' }) referralCount?: number;
  @ApiPropertyOptional({ type: 'string' }) level?: string;
  @ApiPropertyOptional({ type: 'string', format: 'date-time' }) registeredAt?: string;
  @ApiPropertyOptional({ type: () => PreLaunchLocationDto }) location?: PreLaunchLocationDto;
  @ApiPropertyOptional({ type: () => PreLaunchAccessMarketDto }) market?: PreLaunchAccessMarketDto;
  @ApiPropertyOptional({ type: () => PreLaunchPreferencesDto })
  preferences?: PreLaunchPreferencesDto;
}

export class PreLaunchPreferencesSavedResponseDto {
  @ApiProperty({ type: 'boolean' }) saved!: boolean;
  @ApiProperty({ type: () => PreLaunchPreferencesDto })
  preferences!: PreLaunchPreferencesDto;
}

export class PreLaunchBusinessApplicationResponseDto {
  @ApiProperty({ type: 'string' }) message!: string;
  @ApiProperty({ type: 'string' }) applicationId!: string;
}

export class PreLaunchRecordedResponseDto {
  @ApiProperty({ type: 'boolean' }) recorded!: boolean;
}

export class PreLaunchEntityResponseDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string', format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: 'string', format: 'date-time' }) updatedAt!: Date;
}

export class PreLaunchAdminFunnelDto {
  @ApiProperty({ type: 'integer' }) visitors!: number;
  @ApiProperty({ type: 'integer' }) started!: number;
  @ApiProperty({ type: 'integer' }) submitted!: number;
  @ApiProperty({ type: 'integer' }) otpSent!: number;
  @ApiProperty({ type: 'integer' }) verified!: number;
  @ApiProperty({ type: 'integer' }) realVerified!: number;
  @ApiProperty({ type: 'integer' }) syntheticVerified!: number;
  @ApiProperty({ type: 'number' }) verificationRate!: number;
  @ApiProperty({ type: 'integer' }) blocked!: number;
  @ApiProperty({ type: 'integer' }) converted!: number;
}

export class PreLaunchAdminDashboardResponseDto {
  @ApiProperty({ type: () => PreLaunchAdminFunnelDto }) funnel!: PreLaunchAdminFunnelDto;
  @ApiProperty({ type: 'integer' }) applications!: number;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'integer' } })
  interests!: Record<string, number>;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'integer' } })
  realInterests!: Record<string, number>;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'integer' } })
  syntheticInterests!: Record<string, number>;
  @ApiProperty({ type: () => [PreLaunchEntityResponseDto] })
  acquisition!: PreLaunchEntityResponseDto[];
  @ApiProperty({ type: () => [PreLaunchEntityResponseDto] })
  geography!: PreLaunchEntityResponseDto[];
  @ApiProperty({ type: () => [PreLaunchEntityResponseDto] }) markets!: PreLaunchEntityResponseDto[];
  @ApiProperty({ type: () => [PreLaunchEntityResponseDto] })
  partners!: PreLaunchEntityResponseDto[];
}

export class PreLaunchPaginationDto {
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) pageSize!: number;
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) totalPages!: number;
}

export class PreLaunchAdminLeadsResponseDto {
  @ApiProperty({ type: () => [PreLaunchEntityResponseDto] }) items!: PreLaunchEntityResponseDto[];
  @ApiProperty({ type: () => PreLaunchPaginationDto }) pagination!: PreLaunchPaginationDto;
}

export class PreLaunchAdminMarketDetailResponseDto {
  @ApiProperty({ type: () => PreLaunchEntityResponseDto }) market!: PreLaunchEntityResponseDto;
  @ApiProperty({ type: () => [PreLaunchEntityResponseDto] })
  provinces!: PreLaunchEntityResponseDto[];
  @ApiProperty({ type: () => [PreLaunchEntityResponseDto] }) leads!: PreLaunchEntityResponseDto[];
  @ApiProperty({ type: () => [PreLaunchEntityResponseDto] })
  applications!: PreLaunchEntityResponseDto[];
  @ApiProperty({ type: () => [PreLaunchEntityResponseDto] })
  partners!: PreLaunchEntityResponseDto[];
}

export class PreLaunchPublishedApplicationResponseDto {
  @ApiProperty({ type: () => PreLaunchEntityResponseDto })
  application!: PreLaunchEntityResponseDto;
  @ApiProperty({ type: () => PreLaunchEntityResponseDto }) partner!: PreLaunchEntityResponseDto;
}
