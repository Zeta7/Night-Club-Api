CREATE TYPE "NotificationAudience" AS ENUM ('CUSTOMER', 'OPERATIONS');
ALTER TABLE "NotificationTemplate" ADD COLUMN "audience" "NotificationAudience" NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "Notification" ADD COLUMN "audience" "NotificationAudience" NOT NULL DEFAULT 'CUSTOMER';

-- Template identity is authoritative across versions; category and account role are not.
UPDATE "NotificationTemplate" SET "audience" = 'OPERATIONS'
WHERE "key" IN ('ADMIN_NEW_SALE', 'WITHDRAWAL_REQUESTED', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED', 'WITHDRAWAL_PAID')
  OR COALESCE("deepLinkTemplate", '') ~ '^(beerry://)?/?(admin|worker)(/|$|[?])';

-- Keep all historical messages. Recognize review metadata before legacy role-based destinations.
UPDATE "Notification" n SET "audience" = CASE
  WHEN n."templateKey" IN ('ADMIN_NEW_SALE', 'WITHDRAWAL_REQUESTED', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED', 'WITHDRAWAL_PAID') THEN 'OPERATIONS'
  WHEN n."templateKey" IN ('BUSINESS_ACCESS_APPROVED', 'BUSINESS_ACCESS_REJECTED') AND EXISTS (SELECT 1 FROM "User" u WHERE u.id = n."userId" AND u.role IN ('ADMIN', 'SUPER_ADMIN')) THEN 'OPERATIONS'
  WHEN n."templateKey" IN ('PAYMENT_APPROVED', 'PAYMENT_REJECTED', 'PAYMENT_EXPIRED', 'PAYMENT_PARTIALLY_REFUNDED', 'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK', 'QR_AVAILABLE', 'REFERRAL_ASSOCIATED', 'REFERRAL_REWARD_PENDING', 'REFERRAL_REWARD_AVAILABLE', 'REFERRAL_TRANSFER_RECEIVED', 'BUSINESS_ACCESS_APPROVED', 'BUSINESS_ACCESS_REJECTED') THEN 'CUSTOMER'
  WHEN n.category = 'EVENT' AND (n.data ? 'buyerRefundRequestId' OR n.data ? 'cancellationId') THEN 'OPERATIONS'
  WHEN n.category = 'EVENT' AND NOT (COALESCE(n.data, '{}'::jsonb) ? 'eventId') AND EXISTS (SELECT 1 FROM "Order" o WHERE o.id = n.data->>'orderId' AND o."userId" <> n."userId") THEN 'OPERATIONS'
  WHEN n.category = 'EVENT' AND (n.data ? 'eventId' OR EXISTS (SELECT 1 FROM "Order" o WHERE o.id = n.data->>'orderId' AND o."userId" = n."userId")) THEN 'CUSTOMER'
  WHEN COALESCE(n."deepLink", '') ~ '^(beerry://)?/?(admin|worker)(/|$|[?])' THEN 'OPERATIONS'
  ELSE 'CUSTOMER'
END::"NotificationAudience";

-- Older event dispatch inferred an administrative destination from the buyer's role.
UPDATE "Notification" n SET "deepLink" = CASE
  WHEN EXISTS (SELECT 1 FROM "Order" o WHERE o.id = n.data->>'orderId' AND o."userId" = n."userId")
    THEN 'beerry://customer/operations/orders/' || (n.data->>'orderId')
  ELSE 'beerry://customer/qrs?filter=HISTORY'
END
WHERE n.audience = 'CUSTOMER' AND n.category = 'EVENT'
  AND COALESCE(n."deepLink", '') ~ '^(beerry://)?/?(admin|worker)(/|$|[?])';

UPDATE "Notification" n SET "deepLink" = '/admin/profile/business-access'
WHERE n.audience = 'OPERATIONS' AND n."templateKey" IN ('BUSINESS_ACCESS_APPROVED', 'BUSINESS_ACCESS_REJECTED');

CREATE INDEX "Notification_userId_audience_readAt_createdAt_idx" ON "Notification"("userId", "audience", "readAt", "createdAt");
