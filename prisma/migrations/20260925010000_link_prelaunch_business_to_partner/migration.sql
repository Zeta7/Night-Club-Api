ALTER TABLE "PreLaunchPartner"
ADD COLUMN "sourceApplicationId" TEXT;

CREATE UNIQUE INDEX "PreLaunchPartner_sourceApplicationId_key"
ON "PreLaunchPartner"("sourceApplicationId");

ALTER TABLE "PreLaunchPartner"
ADD CONSTRAINT "PreLaunchPartner_sourceApplicationId_fkey"
FOREIGN KEY ("sourceApplicationId") REFERENCES "BusinessPreLaunchApplication"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
