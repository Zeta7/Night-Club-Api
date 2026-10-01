ALTER TABLE "PreLaunchLead"
ADD COLUMN "recoveryTokenHash" TEXT;

CREATE UNIQUE INDEX "PreLaunchLead_recoveryTokenHash_key"
ON "PreLaunchLead"("recoveryTokenHash");
