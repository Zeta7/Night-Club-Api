CREATE TYPE "TicketTypeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SOLD_OUT');

CREATE TABLE "TicketType" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "eventId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "quantityTotal" INTEGER NOT NULL,
    "quantitySold" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER,
    "saleStartAt" TIMESTAMP(3),
    "saleEndAt" TIMESTAMP(3),
    "status" "TicketTypeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TicketType_clubId_idx" ON "TicketType"("clubId");
CREATE INDEX "TicketType_eventId_idx" ON "TicketType"("eventId");
CREATE INDEX "TicketType_status_idx" ON "TicketType"("status");
CREATE INDEX "TicketType_clubId_eventId_idx" ON "TicketType"("clubId", "eventId");

ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
