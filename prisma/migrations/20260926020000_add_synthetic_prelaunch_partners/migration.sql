ALTER TABLE "PreLaunchPartner"
ADD COLUMN "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "syntheticKey" TEXT;

CREATE UNIQUE INDEX "PreLaunchPartner_syntheticKey_key"
ON "PreLaunchPartner"("syntheticKey");
