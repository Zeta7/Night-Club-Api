ALTER TABLE "PreLaunchLead"
ADD COLUMN "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "syntheticKey" TEXT;

CREATE UNIQUE INDEX "PreLaunchLead_syntheticKey_key" ON "PreLaunchLead"("syntheticKey");
