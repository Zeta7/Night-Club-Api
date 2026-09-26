-- Preserve the values already enforced by the existing CHECK constraints.
BEGIN;

CREATE TYPE "EventCancellationMode" AS ENUM ('REFUND_REQUESTED', 'REFUND_DECLINED', 'REPLACEMENT');
CREATE TYPE "EventCancellationStatus" AS ENUM ('PENDING_BEERRY', 'CONTACT_REQUIRED', 'REPLACEMENT_PROPOSED', 'AUTHORIZED', 'REJECTED');
CREATE TYPE "EventBuyerRefundStatus" AS ENUM ('PENDING_BUSINESS', 'BUSINESS_DECLINED', 'PENDING_BEERRY', 'AUTHORIZED', 'REJECTED');
CREATE TYPE "EventRefundJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'WAITING_PROVIDER', 'COMPLETED', 'MANUAL_REVIEW', 'REJECTED');

ALTER TABLE "EventCancellation"
  DROP CONSTRAINT "EventCancellation_mode_check",
  DROP CONSTRAINT "EventCancellation_status_check",
  ALTER COLUMN "mode" TYPE "EventCancellationMode" USING "mode"::"EventCancellationMode",
  ALTER COLUMN "status" TYPE "EventCancellationStatus" USING "status"::"EventCancellationStatus";

ALTER TABLE "EventBuyerRefundRequest"
  DROP CONSTRAINT "EventBuyerRefundRequest_status_check",
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "EventBuyerRefundStatus" USING "status"::"EventBuyerRefundStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING_BUSINESS';

ALTER TABLE "EventRefundJob"
  DROP CONSTRAINT "EventRefundJob_status_check",
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "EventRefundJobStatus" USING "status"::"EventRefundJobStatus",
  ALTER COLUMN "status" SET DEFAULT 'QUEUED';

COMMIT;
