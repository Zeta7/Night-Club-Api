ALTER TABLE "BusinessPreLaunchApplication"
ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "privacyPolicyVersion" TEXT;

UPDATE "BusinessPreLaunchApplication"
SET
  "privacyAcceptedAt" = "createdAt",
  "privacyPolicyVersion" = '2026-09-25'
WHERE "privacyAcceptedAt" IS NULL OR "privacyPolicyVersion" IS NULL;

ALTER TABLE "BusinessPreLaunchApplication"
ALTER COLUMN "privacyAcceptedAt" SET NOT NULL,
ALTER COLUMN "privacyPolicyVersion" SET NOT NULL;
