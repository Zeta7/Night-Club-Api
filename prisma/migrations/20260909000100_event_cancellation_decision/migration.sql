CREATE TABLE "EventCancellation" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "replacementEventId" TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventCancellation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventCancellation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EventCancellation_mode_check" CHECK ("mode" IN ('REFUND_REQUESTED', 'REFUND_DECLINED', 'REPLACEMENT')),
  CONSTRAINT "EventCancellation_status_check" CHECK ("status" IN ('PENDING_BEERRY', 'CONTACT_REQUIRED', 'REPLACEMENT_PROPOSED', 'AUTHORIZED', 'REJECTED'))
);
CREATE UNIQUE INDEX "EventCancellation_eventId_key" ON "EventCancellation"("eventId");
CREATE INDEX "EventCancellation_status_createdAt_idx" ON "EventCancellation"("status", "createdAt");
