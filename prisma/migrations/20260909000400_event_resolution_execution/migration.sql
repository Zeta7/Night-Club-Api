ALTER TABLE "WalletCreditConsumption" ADD COLUMN "restoredCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "WalletCreditConsumption" c SET "restoredCents" = c."amountCents"
FROM "Order" o WHERE o.id = c."orderId" AND o.status IN ('REFUNDED', 'CHARGEBACK');
ALTER TABLE "WalletCreditConsumption" ADD CONSTRAINT "credit_restore_bounds" CHECK ("restoredCents" >= 0 AND "restoredCents" <= "amountCents");
ALTER TABLE "TicketType" ADD COLUMN "replacementReserved" INTEGER NOT NULL DEFAULT 0 CHECK ("replacementReserved" >= 0);
ALTER TABLE "TicketType" ADD CONSTRAINT "ticket_capacity_including_replacements" CHECK ("quantityTotal" >= "quantitySold" + "replacementReserved") NOT VALID;
CREATE TABLE "EventReplacementMapping" (
  id TEXT PRIMARY KEY, "cancellationId" TEXT NOT NULL REFERENCES "EventCancellation"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "itemType" "CommerceItemType" NOT NULL, "sourceItemId" TEXT NOT NULL, "targetItemId" TEXT NOT NULL, "targetName" TEXT NOT NULL,
  "reservedQuantity" INTEGER NOT NULL CHECK ("reservedQuantity" >= 0), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("cancellationId", "itemType", "sourceItemId")
);
CREATE TABLE "EventReplacementAcceptance" (
  id TEXT PRIMARY KEY, "cancellationId" TEXT NOT NULL REFERENCES "EventCancellation"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "orderItemId" TEXT NOT NULL REFERENCES "OrderItem"(id) ON DELETE RESTRICT ON UPDATE CASCADE, "targetEventId" TEXT NOT NULL REFERENCES "Event"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "targetItemId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("cancellationId", "orderItemId")
);
CREATE TABLE "EventRefundJob" (
  id TEXT PRIMARY KEY, "cancellationId" TEXT NOT NULL REFERENCES "EventCancellation"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "orderItemId" TEXT NOT NULL REFERENCES "OrderItem"(id) ON DELETE RESTRICT ON UPDATE CASCADE, "refundRequestId" TEXT UNIQUE REFERENCES "RefundRequest"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','PROCESSING','WAITING_PROVIDER','COMPLETED','MANUAL_REVIEW','REJECTED')),
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0), "authorizedBy" TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT, "leaseToken" TEXT, "manualReviewNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("cancellationId", "orderItemId")
);
CREATE INDEX "EventRefundJob_status_nextRunAt_idx" ON "EventRefundJob"(status, "nextRunAt");

-- Preserve the terms offered to buyers while a replacement has reserved units.
CREATE FUNCTION protect_event_replacement_offer() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "EventReplacementMapping" m WHERE m."targetItemId" = OLD.id AND m."reservedQuantity" > 0) THEN
      RAISE EXCEPTION 'REPLACEMENT_OFFER_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM "EventReplacementMapping" m WHERE m."targetItemId" = OLD.id AND m."reservedQuantity" > 0) AND
     (to_jsonb(NEW) - ARRAY['quantitySold','quantityTotal','replacementReserved','updatedAt']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['quantitySold','quantityTotal','replacementReserved','updatedAt']) THEN
    RAISE EXCEPTION 'REPLACEMENT_OFFER_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER protect_ticket_replacement_offer BEFORE UPDATE OR DELETE ON "TicketType" FOR EACH ROW EXECUTE FUNCTION protect_event_replacement_offer();
CREATE TRIGGER protect_promotion_replacement_offer BEFORE UPDATE OR DELETE ON "Promotion" FOR EACH ROW EXECUTE FUNCTION protect_event_replacement_offer();

-- The products/quantities inside a promised promotion are also part of the offer.
CREATE FUNCTION protect_event_replacement_promotion_items() RETURNS trigger AS $$
DECLARE source_id TEXT; target_id TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN source_id := OLD."promotionId"; END IF;
  IF TG_OP <> 'DELETE' THEN target_id := NEW."promotionId"; END IF;
  PERFORM id FROM "Promotion" WHERE id IN (source_id, target_id) ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "EventReplacementMapping" WHERE "itemType" = 'PROMOTION'
    AND "targetItemId" IN (source_id, target_id) AND "reservedQuantity" > 0) THEN
    RAISE EXCEPTION 'REPLACEMENT_OFFER_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER protect_replacement_promotion_items BEFORE INSERT OR UPDATE OR DELETE ON "PromotionItem"
  FOR EACH ROW EXECUTE FUNCTION protect_event_replacement_promotion_items();
