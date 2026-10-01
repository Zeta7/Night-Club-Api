CREATE TYPE "LaunchMarketStatus" AS ENUM ('COLLECTING_DEMAND', 'ONBOARDING_PARTNERS', 'READY_TO_LAUNCH', 'LAUNCH_SCHEDULED', 'AVAILABLE');
CREATE TYPE "PreLaunchLeadStatus" AS ENUM ('PENDING_OTP', 'VERIFIED', 'BLOCKED', 'CONVERTED');
CREATE TYPE "BusinessPreLaunchApplicationStatus" AS ENUM ('RECEIVED', 'CONTACTED', 'IN_CONVERSATION', 'APPROVED', 'PARTNER', 'ACTIVE', 'REJECTED');
CREATE TYPE "PreLaunchPartnerStatus" AS ENUM ('APPROVED', 'PARTNER', 'ACTIVE', 'INACTIVE');
CREATE TYPE "PreLaunchEventType" AS ENUM ('PAGE_VIEW', 'EARLY_ACCESS_CLICKED', 'REGISTRATION_STARTED', 'REGISTRATION_COMPLETED', 'OTP_REQUESTED', 'PHONE_VERIFIED', 'REFERRAL_SHARED', 'REFERRAL_VERIFIED', 'BUSINESS_FORM_STARTED', 'BUSINESS_FORM_SUBMITTED', 'CITY_VIEWED', 'PARTNER_CLICKED', 'INSTALL_RECORDED', 'USER_CONVERTED', 'SUSPICIOUS_ACTIVITY');

CREATE TABLE "LaunchMarket" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "goal" INTEGER NOT NULL,
  "status" "LaunchMarketStatus" NOT NULL DEFAULT 'COLLECTING_DEMAND',
  "launchAt" TIMESTAMP(3),
  "publicOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "isFallback" BOOLEAN NOT NULL DEFAULT false,
  "benefitsPrepared" INTEGER NOT NULL DEFAULT 0,
  "eventsPrepared" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LaunchMarket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LaunchMarketUbigeo" (
  "id" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "mappingKey" TEXT NOT NULL,
  "departmentId" INTEGER NOT NULL,
  "provinceId" INTEGER,
  "districtId" INTEGER,
  "ubigeoCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LaunchMarketUbigeo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreLaunchLead" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phoneCountryCode" TEXT NOT NULL DEFAULT '+51',
  "phoneNumber" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "phoneVerifiedAt" TIMESTAMP(3),
  "departmentId" INTEGER NOT NULL,
  "provinceId" INTEGER NOT NULL,
  "districtId" INTEGER NOT NULL,
  "departmentName" TEXT NOT NULL,
  "provinceName" TEXT NOT NULL,
  "districtName" TEXT NOT NULL,
  "ubigeoCode" TEXT NOT NULL,
  "launchMarketId" TEXT NOT NULL,
  "interests" TEXT[],
  "isAdultDeclared" BOOLEAN NOT NULL,
  "privacyAcceptedAt" TIMESTAMP(3) NOT NULL,
  "privacyPolicyVersion" TEXT NOT NULL,
  "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
  "marketingConsentAt" TIMESTAMP(3),
  "referralCode" TEXT NOT NULL,
  "referredById" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "sourceBusinessId" TEXT,
  "influencerCode" TEXT,
  "landingOrigin" TEXT,
  "status" "PreLaunchLeadStatus" NOT NULL DEFAULT 'PENDING_OTP',
  "accessTokenHash" TEXT NOT NULL,
  "convertedToUserId" TEXT,
  "convertedToUserAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PreLaunchLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreLaunchOtp" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreLaunchOtp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreLaunchPartner" (
  "id" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "districtName" TEXT NOT NULL,
  "logoUrl" TEXT,
  "imageUrl" TEXT,
  "benefitCount" INTEGER NOT NULL DEFAULT 0,
  "status" "PreLaunchPartnerStatus" NOT NULL DEFAULT 'APPROVED',
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "publicOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PreLaunchPartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessPreLaunchApplication" (
  "id" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "departmentId" INTEGER NOT NULL,
  "provinceId" INTEGER NOT NULL,
  "districtId" INTEGER NOT NULL,
  "departmentName" TEXT NOT NULL,
  "provinceName" TEXT NOT NULL,
  "districtName" TEXT NOT NULL,
  "ubigeoCode" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "socialNetworks" TEXT,
  "comment" TEXT,
  "status" "BusinessPreLaunchApplicationStatus" NOT NULL DEFAULT 'RECEIVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessPreLaunchApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreLaunchLevel" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "minimumReferrals" INTEGER NOT NULL,
  "publicOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PreLaunchLevel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreLaunchEvent" (
  "id" TEXT NOT NULL,
  "type" "PreLaunchEventType" NOT NULL,
  "leadId" TEXT,
  "launchMarketId" TEXT,
  "sourceBusinessId" TEXT,
  "sessionId" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "landingOrigin" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreLaunchEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LaunchMarket_slug_key" ON "LaunchMarket"("slug");
CREATE INDEX "LaunchMarket_isPublic_publicOrder_idx" ON "LaunchMarket"("isPublic", "publicOrder");
CREATE INDEX "LaunchMarket_status_idx" ON "LaunchMarket"("status");
CREATE UNIQUE INDEX "LaunchMarketUbigeo_mappingKey_key" ON "LaunchMarketUbigeo"("mappingKey");
CREATE UNIQUE INDEX "LaunchMarketUbigeo_departmentId_provinceId_districtId_key" ON "LaunchMarketUbigeo"("departmentId", "provinceId", "districtId");
CREATE UNIQUE INDEX "LaunchMarketUbigeo_ubigeoCode_key" ON "LaunchMarketUbigeo"("ubigeoCode");
CREATE INDEX "LaunchMarketUbigeo_marketId_idx" ON "LaunchMarketUbigeo"("marketId");
CREATE UNIQUE INDEX "PreLaunchLead_email_key" ON "PreLaunchLead"("email");
CREATE UNIQUE INDEX "PreLaunchLead_phoneE164_key" ON "PreLaunchLead"("phoneE164");
CREATE UNIQUE INDEX "PreLaunchLead_referralCode_key" ON "PreLaunchLead"("referralCode");
CREATE UNIQUE INDEX "PreLaunchLead_accessTokenHash_key" ON "PreLaunchLead"("accessTokenHash");
CREATE UNIQUE INDEX "PreLaunchLead_convertedToUserId_key" ON "PreLaunchLead"("convertedToUserId");
CREATE INDEX "PreLaunchLead_launchMarketId_status_createdAt_idx" ON "PreLaunchLead"("launchMarketId", "status", "createdAt");
CREATE INDEX "PreLaunchLead_referredById_status_idx" ON "PreLaunchLead"("referredById", "status");
CREATE INDEX "PreLaunchLead_sourceBusinessId_status_idx" ON "PreLaunchLead"("sourceBusinessId", "status");
CREATE INDEX "PreLaunchLead_ubigeoCode_status_idx" ON "PreLaunchLead"("ubigeoCode", "status");
CREATE INDEX "PreLaunchOtp_leadId_consumedAt_createdAt_idx" ON "PreLaunchOtp"("leadId", "consumedAt", "createdAt");
CREATE UNIQUE INDEX "PreLaunchPartner_slug_key" ON "PreLaunchPartner"("slug");
CREATE INDEX "PreLaunchPartner_marketId_isPublic_publicOrder_idx" ON "PreLaunchPartner"("marketId", "isPublic", "publicOrder");
CREATE INDEX "BusinessPreLaunchApplication_status_createdAt_idx" ON "BusinessPreLaunchApplication"("status", "createdAt");
CREATE INDEX "BusinessPreLaunchApplication_ubigeoCode_idx" ON "BusinessPreLaunchApplication"("ubigeoCode");
CREATE UNIQUE INDEX "PreLaunchLevel_minimumReferrals_key" ON "PreLaunchLevel"("minimumReferrals");
CREATE INDEX "PreLaunchLevel_isActive_minimumReferrals_idx" ON "PreLaunchLevel"("isActive", "minimumReferrals");
CREATE INDEX "PreLaunchEvent_type_createdAt_idx" ON "PreLaunchEvent"("type", "createdAt");
CREATE INDEX "PreLaunchEvent_leadId_type_createdAt_idx" ON "PreLaunchEvent"("leadId", "type", "createdAt");
CREATE INDEX "PreLaunchEvent_ipHash_type_createdAt_idx" ON "PreLaunchEvent"("ipHash", "type", "createdAt");
CREATE INDEX "PreLaunchEvent_launchMarketId_type_createdAt_idx" ON "PreLaunchEvent"("launchMarketId", "type", "createdAt");
CREATE INDEX "PreLaunchEvent_sourceBusinessId_type_createdAt_idx" ON "PreLaunchEvent"("sourceBusinessId", "type", "createdAt");

ALTER TABLE "LaunchMarketUbigeo" ADD CONSTRAINT "LaunchMarketUbigeo_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "LaunchMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreLaunchLead" ADD CONSTRAINT "PreLaunchLead_launchMarketId_fkey" FOREIGN KEY ("launchMarketId") REFERENCES "LaunchMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PreLaunchLead" ADD CONSTRAINT "PreLaunchLead_sourceBusinessId_fkey" FOREIGN KEY ("sourceBusinessId") REFERENCES "PreLaunchPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PreLaunchLead" ADD CONSTRAINT "PreLaunchLead_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "PreLaunchLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PreLaunchLead" ADD CONSTRAINT "PreLaunchLead_convertedToUserId_fkey" FOREIGN KEY ("convertedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PreLaunchOtp" ADD CONSTRAINT "PreLaunchOtp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "PreLaunchLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreLaunchPartner" ADD CONSTRAINT "PreLaunchPartner_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "LaunchMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreLaunchEvent" ADD CONSTRAINT "PreLaunchEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "PreLaunchLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
