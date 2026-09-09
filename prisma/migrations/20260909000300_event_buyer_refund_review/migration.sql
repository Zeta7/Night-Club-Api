CREATE TABLE "EventBuyerRefundRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cancellationId" TEXT NOT NULL REFERENCES "EventCancellation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "orderItemId" TEXT NOT NULL REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'PENDING_BUSINESS',
  "reason" TEXT NOT NULL,
  "businessReason" TEXT,
  "businessReviewedBy" TEXT,
  "beerryReason" TEXT,
  "beerryReviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventBuyerRefundRequest_status_check" CHECK ("status" IN ('PENDING_BUSINESS', 'BUSINESS_DECLINED', 'PENDING_BEERRY', 'AUTHORIZED', 'REJECTED'))
);
CREATE UNIQUE INDEX "EventBuyerRefundRequest_cancellationId_orderItemId_key" ON "EventBuyerRefundRequest"("cancellationId", "orderItemId");
CREATE INDEX "EventBuyerRefundRequest_status_createdAt_idx" ON "EventBuyerRefundRequest"("status", "createdAt");
