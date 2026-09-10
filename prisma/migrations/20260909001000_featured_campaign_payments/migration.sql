ALTER TYPE "PaymentPurpose" ADD VALUE 'FEATURED_CAMPAIGN';

CREATE TYPE "FeaturedTargetType" AS ENUM ('BUSINESS', 'EVENT');
CREATE TYPE "FeaturedCampaignStatus" AS ENUM (
  'PENDING_PAYMENT',
  'ACTIVE',
  'REJECTED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TABLE "FeaturedCampaign" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "eventId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "targetType" "FeaturedTargetType" NOT NULL,
  "status" "FeaturedCampaignStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "durationDays" INTEGER NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PEN',
  "idempotencyKey" TEXT NOT NULL,
  "paidAt" TIMESTAMP(3),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeaturedCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "featured_campaign_duration_positive" CHECK ("durationDays" > 0),
  CONSTRAINT "featured_campaign_price_positive" CHECK ("priceCents" > 0),
  CONSTRAINT "featured_campaign_target_valid" CHECK (
    ("targetType" = 'BUSINESS' AND "eventId" IS NULL) OR
    ("targetType" = 'EVENT' AND "eventId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "FeaturedCampaign_idempotencyKey_key"
  ON "FeaturedCampaign"("idempotencyKey");
CREATE INDEX "FeaturedCampaign_clubId_status_endsAt_idx"
  ON "FeaturedCampaign"("clubId", "status", "endsAt");
CREATE INDEX "FeaturedCampaign_eventId_idx"
  ON "FeaturedCampaign"("eventId");
CREATE INDEX "FeaturedCampaign_status_startsAt_endsAt_idx"
  ON "FeaturedCampaign"("status", "startsAt", "endsAt");
CREATE UNIQUE INDEX "FeaturedCampaign_one_current_business_idx"
  ON "FeaturedCampaign"("clubId")
  WHERE "targetType" = 'BUSINESS'
    AND "status" IN ('PENDING_PAYMENT', 'ACTIVE');
CREATE UNIQUE INDEX "FeaturedCampaign_one_current_event_idx"
  ON "FeaturedCampaign"("clubId", "eventId")
  WHERE "targetType" = 'EVENT'
    AND "status" IN ('PENDING_PAYMENT', 'ACTIVE');

ALTER TABLE "PaymentAttempt" ADD COLUMN "featuredCampaignId" TEXT;
CREATE UNIQUE INDEX "PaymentAttempt_featuredCampaignId_key"
  ON "PaymentAttempt"("featuredCampaignId");
CREATE INDEX "PaymentAttempt_featuredCampaignId_idx"
  ON "PaymentAttempt"("featuredCampaignId");

ALTER TABLE "FeaturedCampaign" ADD CONSTRAINT "FeaturedCampaign_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeaturedCampaign" ADD CONSTRAINT "FeaturedCampaign_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeaturedCampaign" ADD CONSTRAINT "FeaturedCampaign_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_featuredCampaignId_fkey"
  FOREIGN KEY ("featuredCampaignId") REFERENCES "FeaturedCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
