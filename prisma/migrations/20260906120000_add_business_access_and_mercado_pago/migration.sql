CREATE TYPE "MarketplaceFeeSource" AS ENUM ('GLOBAL', 'BUSINESS_OVERRIDE');
CREATE TYPE "BusinessAccessRequestType" AS ENUM ('REGISTER_NEW_BUSINESS', 'ADMINISTER_EXISTING_BUSINESS');
CREATE TYPE "BusinessAccessRequestStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "SellerConnectionStatus" AS ENUM ('NOT_CONNECTED', 'PENDING', 'CONNECTED', 'REAUTHORIZATION_REQUIRED', 'DISCONNECTED', 'BLOCKED');
ALTER TYPE "OrderPaymentMethod" ADD VALUE 'MERCADO_PAGO';
ALTER TYPE "OrderStatus" ADD VALUE 'CHARGEBACK';
ALTER TYPE "PaymentAttemptStatus" ADD VALUE 'CHARGEBACK';

ALTER TABLE "Club" ADD COLUMN "marketplaceFeeBps" INTEGER;

ALTER TABLE "PaymentAttempt"
  ADD COLUMN "externalCheckoutId" TEXT,
  ADD COLUMN "sellerExternalId" TEXT,
  ADD COLUMN "grossAmountCents" INTEGER,
  ADD COLUMN "customerFundedSnapshotCents" INTEGER,
  ADD COLUMN "marketplaceFeeBps" INTEGER,
  ADD COLUMN "marketplaceFeeCents" INTEGER,
  ADD COLUMN "sellerExpectedNetCents" INTEGER,
  ADD COLUMN "feeSource" "MarketplaceFeeSource",
  ADD COLUMN "refundedAmountCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "RefundRequest"
  ADD COLUMN "requestedAmountCents" INTEGER,
  ADD COLUMN "approvedAmountCents" INTEGER,
  ADD COLUMN "processedAmountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "marketplaceFeeRefundedCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "externalRefundId" TEXT;

CREATE TABLE "BusinessAccessRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "BusinessAccessRequestType" NOT NULL,
  "status" "BusinessAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "businessName" TEXT NOT NULL,
  "taxId" TEXT,
  "location" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "socialUrl" TEXT,
  "requestedClubId" TEXT,
  "comment" TEXT,
  "reviewedByUserId" TEXT,
  "reviewComment" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceSellerConnection" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalSellerId" TEXT NOT NULL,
  "externalAccountHint" TEXT,
  "accessTokenEncrypted" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "scopes" TEXT[] NOT NULL,
  "status" "SellerConnectionStatus" NOT NULL DEFAULT 'PENDING',
  "connectedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceSellerConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceOAuthState" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessAccessRequest_userId_status_createdAt_idx" ON "BusinessAccessRequest"("userId", "status", "createdAt");
CREATE INDEX "BusinessAccessRequest_type_createdAt_idx" ON "BusinessAccessRequest"("type", "createdAt");
CREATE INDEX "BusinessAccessRequest_requestedClubId_status_idx" ON "BusinessAccessRequest"("requestedClubId", "status");
CREATE INDEX "BusinessAccessRequest_status_createdAt_idx" ON "BusinessAccessRequest"("status", "createdAt");
CREATE UNIQUE INDEX "BusinessAccessRequest_active_unique" ON "BusinessAccessRequest"("userId", "type", COALESCE("requestedClubId", lower("businessName"))) WHERE "status" IN ('PENDING', 'UNDER_REVIEW');

CREATE UNIQUE INDEX "MarketplaceSellerConnection_clubId_provider_key" ON "MarketplaceSellerConnection"("clubId", "provider");
CREATE UNIQUE INDEX "MarketplaceSellerConnection_provider_externalSellerId_key" ON "MarketplaceSellerConnection"("provider", "externalSellerId");
CREATE INDEX "MarketplaceSellerConnection_status_updatedAt_idx" ON "MarketplaceSellerConnection"("status", "updatedAt");
CREATE UNIQUE INDEX "MarketplaceOAuthState_stateHash_key" ON "MarketplaceOAuthState"("stateHash");
CREATE INDEX "MarketplaceOAuthState_clubId_provider_expiresAt_idx" ON "MarketplaceOAuthState"("clubId", "provider", "expiresAt");
CREATE INDEX "MarketplaceOAuthState_userId_expiresAt_idx" ON "MarketplaceOAuthState"("userId", "expiresAt");
CREATE INDEX "PaymentAttempt_provider_externalCheckoutId_idx" ON "PaymentAttempt"("provider", "externalCheckoutId");
CREATE INDEX "PaymentAttempt_provider_sellerExternalId_idx" ON "PaymentAttempt"("provider", "sellerExternalId");
CREATE INDEX "RefundRequest_externalRefundId_idx" ON "RefundRequest"("externalRefundId");

ALTER TABLE "BusinessAccessRequest" ADD CONSTRAINT "BusinessAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessAccessRequest" ADD CONSTRAINT "BusinessAccessRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessAccessRequest" ADD CONSTRAINT "BusinessAccessRequest_requestedClubId_fkey" FOREIGN KEY ("requestedClubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceSellerConnection" ADD CONSTRAINT "MarketplaceSellerConnection_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOAuthState" ADD CONSTRAINT "MarketplaceOAuthState_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOAuthState" ADD CONSTRAINT "MarketplaceOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Club" ADD CONSTRAINT "Club_marketplaceFeeBps_check" CHECK ("marketplaceFeeBps" IS NULL OR ("marketplaceFeeBps" >= 0 AND "marketplaceFeeBps" <= 10000));
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_marketplace_snapshot_check" CHECK (
  ("marketplaceFeeBps" IS NULL AND "marketplaceFeeCents" IS NULL AND "sellerExpectedNetCents" IS NULL)
  OR ("marketplaceFeeBps" BETWEEN 0 AND 10000 AND "marketplaceFeeCents" BETWEEN 0 AND "amountCents" AND "sellerExpectedNetCents" >= 0)
);
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_amounts_check" CHECK (
  ("requestedAmountCents" IS NULL OR "requestedAmountCents" > 0)
  AND ("approvedAmountCents" IS NULL OR "approvedAmountCents" > 0)
  AND "processedAmountCents" >= 0
  AND "marketplaceFeeRefundedCents" >= 0
);
