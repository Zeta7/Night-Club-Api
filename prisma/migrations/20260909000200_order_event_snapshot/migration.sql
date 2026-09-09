ALTER TABLE "OrderItem" ADD COLUMN "eventId" TEXT, ADD COLUMN "eventSnapshot" JSONB;

-- Only recover relationships supported by issued rights. Current catalogue dates
-- cannot prove what was purchased historically; do not fabricate that snapshot.
WITH evidence AS (
  SELECT "orderItemId", "eventId" FROM "Ticket" WHERE "eventId" IS NOT NULL
  UNION
  SELECT "orderItemId", "eventId" FROM "ConsumableRight" WHERE "eventId" IS NOT NULL
), unambiguous AS (
  SELECT "orderItemId", MIN("eventId") AS "eventId"
  FROM evidence GROUP BY "orderItemId" HAVING COUNT(DISTINCT "eventId") = 1
)
UPDATE "OrderItem" item SET "eventId" = evidence."eventId",
  "eventSnapshot" = jsonb_build_object('source', 'HISTORICAL_RIGHTS')
FROM unambiguous evidence WHERE item."id" = evidence."orderItemId";

CREATE INDEX "OrderItem_eventId_orderId_idx" ON "OrderItem"("eventId", "orderId");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
