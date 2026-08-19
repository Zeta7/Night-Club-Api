-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'WORKER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_PHONE_CONFIRMATION', 'ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PhoneVerificationPurpose" AS ENUM ('REGISTRATION', 'ACCOUNT_RECOVERY');

-- CreateEnum
CREATE TYPE "ClubStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ClubWorkerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WorkerShiftStatus" AS ENUM ('ACTIVE', 'CLOSED', 'REVOKED');

-- CreateEnum
CREATE TYPE "WorkerDeviceStatus" AS ENUM ('AUTHORIZED', 'REVOKED');

-- CreateEnum
CREATE TYPE "WorkerPermission" AS ENUM ('VALIDATE_TICKETS', 'VALIDATE_PRODUCTS', 'VALIDATE_PROMOTIONS', 'VIEW_CAPACITY', 'MANAGE_CAPACITY', 'VIEW_DASHBOARD', 'VIEW_EVENT_ATTENDANCE', 'VIEW_SALES', 'REQUEST_REFUNDS', 'VIEW_OPERATIONS', 'MANAGE_BUSINESS_CONFIG');

-- CreateEnum
CREATE TYPE "RefundRequestStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SALE_ACTIVE', 'SOLD_OUT', 'IN_PROGRESS', 'FINISHED', 'CANCELLED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "TicketTypeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SOLD_OUT');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PromotionPricingMode" AS ENUM ('CALCULATED', 'MANUAL_FINAL_PRICE');

-- CreateEnum
CREATE TYPE "PromotionItemType" AS ENUM ('PRODUCT', 'TICKET');

-- CreateEnum
CREATE TYPE "PromotionDiscountType" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'TEMPORARY', 'USED');

-- CreateEnum
CREATE TYPE "WalletMovementType" AS ENUM ('TOP_UP', 'PURCHASE', 'REFUND', 'ADJUSTMENT', 'REFERRAL_REWARD', 'REFERRAL_REVERSAL', 'CREDIT_EXPIRATION', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "WalletMovementStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReferralCaptureMethod" AS ENUM ('LINK', 'CODE', 'QR');

-- CreateEnum
CREATE TYPE "ReferralExpirationMode" AS ENUM ('SAME_MONTH_END', 'NEXT_MONTH_END', 'FIXED_DAYS', 'NONE');

-- CreateEnum
CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'AVAILABLE', 'PARTIALLY_USED', 'USED', 'EXPIRED', 'REVERSED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "WalletCreditSource" AS ENUM ('TOP_UP', 'REFUND', 'REFERRAL_REWARD', 'PROMOTION', 'TRANSFER', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletCreditLotStatus" AS ENUM ('PENDING', 'AVAILABLE', 'PARTIALLY_USED', 'USED', 'EXPIRED', 'REVERSED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "WalletTransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ReferralFraudFlagStatus" AS ENUM ('OPEN', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('ORDER_PAYMENT', 'WALLET_TOP_UP');

-- CreateEnum
CREATE TYPE "OrderPaymentMethod" AS ENUM ('FLOW', 'BEERRY_WALLET', 'SIMULATED');

-- CreateEnum
CREATE TYPE "WalletTopUpStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED', 'CHARGEDBACK');

-- CreateEnum
CREATE TYPE "PaymentProviderEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'CONFIRMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('PAYMENT', 'ORDER', 'QR', 'EVENT', 'PROMOTION', 'STOCK', 'WORKER', 'WITHDRAWAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannelType" AS ENUM ('IN_APP', 'PUSH', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "QrValidationOutcome" AS ENUM ('VALID', 'INVALID', 'REPEATED', 'REVERSED');

-- CreateEnum
CREATE TYPE "CapacityMovementType" AS ENUM ('ENTRY', 'EXIT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FinancialAccountOwnerType" AS ENUM ('CUSTOMER', 'CLUB', 'PLATFORM', 'PROVIDER');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('SALE', 'REFUND', 'CHARGEBACK', 'SETTLEMENT', 'WITHDRAWAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerEntryDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "FinancialBalanceBucket" AS ENUM ('PENDING', 'AVAILABLE', 'HELD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "CommerceItemType" AS ENUM ('TICKET', 'PRODUCT', 'PROMOTION');

-- CreateEnum
CREATE TYPE "RedeemableStatus" AS ENUM ('AVAILABLE', 'USED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phoneCountryCode" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phoneVerifiedAt" TIMESTAMP(3),
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_PHONE_CONFIRMATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "referralCode" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "totalSpentCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "category" "NotificationCategory" NOT NULL,
    "titleTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "deepLinkTemplate" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "templateKey" TEXT,
    "templateVersion" INTEGER,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deepLink" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "NotificationChannelType" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "providerData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletMovement" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletMovementType" NOT NULL,
    "status" "WalletMovementStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WalletMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralProgramSettings" (
    "id" TEXT NOT NULL DEFAULT 'referral-program',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "platformCommissionBps" INTEGER NOT NULL DEFAULT 600,
    "rewardBps" INTEGER NOT NULL DEFAULT 100,
    "minimumPlatformMarginBps" INTEGER NOT NULL DEFAULT 300,
    "minimumPurchaseCents" INTEGER NOT NULL DEFAULT 0,
    "maximumRewardPerOrderCents" INTEGER,
    "maximumMonthlyRewardCents" INTEGER,
    "holdHours" INTEGER NOT NULL DEFAULT 24,
    "expirationMode" "ReferralExpirationMode" NOT NULL DEFAULT 'NEXT_MONTH_END',
    "expirationDays" INTEGER,
    "associationWindowDays" INTEGER NOT NULL DEFAULT 7,
    "maxCreditUsageBps" INTEGER NOT NULL DEFAULT 10000,
    "transfersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxDailyTransferCents" INTEGER,
    "maxMonthlyTransferCents" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralProgramSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReferral" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "captureMethod" "ReferralCaptureMethod" NOT NULL,
    "codeSnapshot" TEXT NOT NULL,
    "associatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "firstPaidOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "beneficiaryUserId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
    "eligibleBaseCents" INTEGER NOT NULL,
    "platformCommissionBps" INTEGER NOT NULL,
    "rewardBps" INTEGER NOT NULL,
    "settingsVersion" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "availableSince" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletCreditLot" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "source" "WalletCreditSource" NOT NULL,
    "sourceReferenceId" TEXT,
    "referralRewardId" TEXT,
    "status" "WalletCreditLotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "originalAmountCents" INTEGER NOT NULL,
    "remainingAmountCents" INTEGER NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletCreditLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletCreditConsumption" (
    "id" TEXT NOT NULL,
    "creditLotId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletCreditConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransfer" (
    "id" TEXT NOT NULL,
    "fromWalletId" TEXT NOT NULL,
    "toWalletId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "WalletTransferStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "completedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransferAllocation" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "sourceCreditLotId" TEXT NOT NULL,
    "destinationCreditLotId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "WalletTransferAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralFraudFlag" (
    "id" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "relatedUserId" TEXT,
    "referralId" TEXT,
    "rewardId" TEXT,
    "type" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "status" "ReferralFraudFlagStatus" NOT NULL DEFAULT 'OPEN',
    "metadata" JSONB,
    "reviewedByUserId" TEXT,
    "resolutionNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralFraudFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerType" "FinancialAccountOwnerType" NOT NULL,
    "userId" TEXT,
    "clubId" TEXT,
    "provider" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "pendingCents" INTEGER NOT NULL DEFAULT 0,
    "availableCents" INTEGER NOT NULL DEFAULT 0,
    "heldCents" INTEGER NOT NULL DEFAULT 0,
    "withdrawnCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "orderId" TEXT,
    "paymentAttemptId" TEXT,
    "providerEventId" TEXT,
    "reversalOfId" TEXT,
    "withdrawalRequestId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "debitTotalCents" INTEGER NOT NULL,
    "creditTotalCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "direction" "LedgerEntryDirection" NOT NULL,
    "bucket" "FinancialBalanceBucket" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubFinancialProfile" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "taxDocumentType" TEXT NOT NULL,
    "taxDocumentNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAccountType" TEXT NOT NULL,
    "bankAccountEncrypted" TEXT NOT NULL,
    "bankAccountLast4" TEXT NOT NULL,
    "bankAccountHolder" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubFinancialProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "bankAccountLast4" TEXT NOT NULL,
    "requestNote" TEXT,
    "rejectionReason" TEXT,
    "paymentReference" TEXT,
    "proofUrl" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneVerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneCountryCode" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "PhoneVerificationPurpose" NOT NULL DEFAULT 'REGISTRATION',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'club',
    "addressJson" JSONB,
    "contactJson" JSONB,
    "coverImageUrl" TEXT,
    "profileImageUrl" TEXT,
    "socialMediaJson" JSONB,
    "scheduleJson" JSONB,
    "status" "ClubStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubAdmin" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubWorker" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleLabel" TEXT,
    "status" "ClubWorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" "WorkerPermission"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignedDoor" TEXT,
    "assignedZone" TEXT,
    "assignedPoint" TEXT,

    CONSTRAINT "ClubWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOccupancy" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "reentryAllowed" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOccupancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityMovement" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "ticketId" TEXT,
    "workerShiftId" TEXT,
    "type" "CapacityMovementType" NOT NULL,
    "delta" INTEGER NOT NULL,
    "previousCount" INTEGER NOT NULL,
    "newCount" INTEGER NOT NULL,
    "reason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerShift" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "eventId" TEXT,
    "status" "WorkerShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedDoor" TEXT,
    "assignedZone" TEXT,
    "assignedPoint" TEXT,
    "deviceFingerprint" TEXT,
    "openedByUserId" TEXT NOT NULL,
    "closedByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerAuthorizedDevice" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" "WorkerDeviceStatus" NOT NULL DEFAULT 'AUTHORIZED',
    "authorizedByUserId" TEXT NOT NULL,
    "revokedByUserId" TEXT,
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerAuthorizedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "stockQuantity" INTEGER NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "eventId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "pricingMode" "PromotionPricingMode" NOT NULL DEFAULT 'CALCULATED',
    "basePriceCents" INTEGER NOT NULL,
    "finalPriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "status" "PromotionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionItem" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "itemType" "PromotionItemType" NOT NULL,
    "productId" TEXT,
    "ticketTypeId" TEXT,
    "quantity" INTEGER NOT NULL,
    "baseUnitPriceCents" INTEGER NOT NULL,
    "discountType" "PromotionDiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "discountedUnitPriceCents" INTEGER NOT NULL,
    "lineBaseTotalCents" INTEGER NOT NULL,
    "lineFinalTotalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalCents" INTEGER NOT NULL,
    "promotionalCreditUsedCents" INTEGER NOT NULL DEFAULT 0,
    "walletBalanceUsedCents" INTEGER NOT NULL DEFAULT 0,
    "customerFundedCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "simulatedPayment" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" "OrderPaymentMethod" NOT NULL DEFAULT 'SIMULATED',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "resolutionNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubOperationalProfile" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "refundPolicy" TEXT,
    "responsibleName" TEXT,
    "responsibleEmail" TEXT,
    "responsiblePhone" TEXT,
    "approvalDocumentUploadIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubOperationalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "resourceType" "CommerceItemType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "itemType" "CommerceItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "walletTopUpId" TEXT,
    "purpose" "PaymentPurpose" NOT NULL DEFAULT 'ORDER_PAYMENT',
    "provider" TEXT NOT NULL,
    "externalPaymentId" TEXT,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "providerData" JSONB,
    "approvedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTopUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "status" "WalletTopUpStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderEvent" (
    "id" TEXT NOT NULL,
    "paymentAttemptId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "PaymentProviderEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "itemType" "CommerceItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "eventId" TEXT,
    "ticketTypeId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "signatureVersion" TEXT NOT NULL DEFAULT 'v1',
    "status" "RedeemableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 1,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumableRight" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "eventId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "sourceType" "CommerceItemType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "productId" TEXT,
    "promotionId" TEXT,
    "code" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "signatureVersion" TEXT NOT NULL DEFAULT 'v1',
    "status" "RedeemableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 1,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumableRight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrValidationAttempt" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "outcome" "QrValidationOutcome" NOT NULL,
    "codeFingerprint" TEXT NOT NULL,
    "reasonCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrValidationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "clubId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "deviceFingerprint" TEXT,
    "correlationId" TEXT,
    "actorRoleSnapshot" TEXT,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "previousHash" TEXT,
    "integrityHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditPolicy" (
    "id" TEXT NOT NULL DEFAULT 'audit',
    "retentionDays" INTEGER NOT NULL DEFAULT 730,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingFileDeletion" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PendingFileDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_phoneCountryCode_phoneNumber_idx" ON "User"("phoneCountryCode", "phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneCountryCode_phoneNumber_key" ON "User"("phoneCountryCode", "phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_key_active_idx" ON "NotificationTemplate"("key", "active");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_key_version_key" ON "NotificationTemplate"("key", "version");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_category_createdAt_idx" ON "Notification"("userId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_category_key" ON "NotificationPreference"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_enabled_idx" ON "DeviceToken"("userId", "enabled");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_key" ON "NotificationDelivery"("notificationId", "channel");

-- CreateIndex
CREATE INDEX "WalletMovement_walletId_createdAt_idx" ON "WalletMovement"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletMovement_referenceId_idx" ON "WalletMovement"("referenceId");

-- CreateIndex
CREATE INDEX "WalletMovement_status_idx" ON "WalletMovement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReferral_referredUserId_key" ON "CustomerReferral"("referredUserId");

-- CreateIndex
CREATE INDEX "CustomerReferral_referrerUserId_associatedAt_idx" ON "CustomerReferral"("referrerUserId", "associatedAt");

-- CreateIndex
CREATE INDEX "CustomerReferral_firstPaidOrderId_idx" ON "CustomerReferral"("firstPaidOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReferral_referrerUserId_referredUserId_key" ON "CustomerReferral"("referrerUserId", "referredUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_orderId_key" ON "ReferralReward"("orderId");

-- CreateIndex
CREATE INDEX "ReferralReward_beneficiaryUserId_status_createdAt_idx" ON "ReferralReward"("beneficiaryUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralReward_buyerUserId_createdAt_idx" ON "ReferralReward"("buyerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralReward_status_availableAt_idx" ON "ReferralReward"("status", "availableAt");

-- CreateIndex
CREATE INDEX "ReferralReward_expiresAt_idx" ON "ReferralReward"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletCreditLot_referralRewardId_key" ON "WalletCreditLot"("referralRewardId");

-- CreateIndex
CREATE INDEX "WalletCreditLot_walletId_status_expiresAt_idx" ON "WalletCreditLot"("walletId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "WalletCreditLot_source_sourceReferenceId_idx" ON "WalletCreditLot"("source", "sourceReferenceId");

-- CreateIndex
CREATE INDEX "WalletCreditConsumption_orderId_idx" ON "WalletCreditConsumption"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletCreditConsumption_creditLotId_orderId_key" ON "WalletCreditConsumption"("creditLotId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransfer_idempotencyKey_key" ON "WalletTransfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletTransfer_fromWalletId_createdAt_idx" ON "WalletTransfer"("fromWalletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransfer_toWalletId_createdAt_idx" ON "WalletTransfer"("toWalletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransfer_status_createdAt_idx" ON "WalletTransfer"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransferAllocation_destinationCreditLotId_idx" ON "WalletTransferAllocation"("destinationCreditLotId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransferAllocation_transferId_sourceCreditLotId_key" ON "WalletTransferAllocation"("transferId", "sourceCreditLotId");

-- CreateIndex
CREATE INDEX "ReferralFraudFlag_subjectUserId_status_createdAt_idx" ON "ReferralFraudFlag"("subjectUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralFraudFlag_relatedUserId_status_idx" ON "ReferralFraudFlag"("relatedUserId", "status");

-- CreateIndex
CREATE INDEX "ReferralFraudFlag_referralId_idx" ON "ReferralFraudFlag"("referralId");

-- CreateIndex
CREATE INDEX "ReferralFraudFlag_rewardId_idx" ON "ReferralFraudFlag"("rewardId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_code_key" ON "FinancialAccount"("code");

-- CreateIndex
CREATE INDEX "FinancialAccount_ownerType_idx" ON "FinancialAccount"("ownerType");

-- CreateIndex
CREATE INDEX "FinancialAccount_userId_idx" ON "FinancialAccount"("userId");

-- CreateIndex
CREATE INDEX "FinancialAccount_clubId_idx" ON "FinancialAccount"("clubId");

-- CreateIndex
CREATE INDEX "FinancialAccount_provider_idx" ON "FinancialAccount"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_reference_key" ON "LedgerTransaction"("reference");

-- CreateIndex
CREATE INDEX "LedgerTransaction_orderId_postedAt_idx" ON "LedgerTransaction"("orderId", "postedAt");

-- CreateIndex
CREATE INDEX "LedgerTransaction_paymentAttemptId_idx" ON "LedgerTransaction"("paymentAttemptId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_providerEventId_idx" ON "LedgerTransaction"("providerEventId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_withdrawalRequestId_idx" ON "LedgerTransaction"("withdrawalRequestId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_type_postedAt_idx" ON "LedgerTransaction"("type", "postedAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_bucket_createdAt_idx" ON "LedgerEntry"("accountId", "bucket", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClubFinancialProfile_clubId_key" ON "ClubFinancialProfile"("clubId");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_clubId_createdAt_idx" ON "WithdrawalRequest"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_status_createdAt_idx" ON "WithdrawalRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_requestedByUserId_createdAt_idx" ON "WithdrawalRequest"("requestedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneVerificationCode_phoneCountryCode_phoneNumber_purpose_idx" ON "PhoneVerificationCode"("phoneCountryCode", "phoneNumber", "purpose");

-- CreateIndex
CREATE INDEX "PhoneVerificationCode_expiresAt_idx" ON "PhoneVerificationCode"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");

-- CreateIndex
CREATE INDEX "Club_status_idx" ON "Club"("status");

-- CreateIndex
CREATE INDEX "ClubAdmin_userId_idx" ON "ClubAdmin"("userId");

-- CreateIndex
CREATE INDEX "ClubAdmin_clubId_idx" ON "ClubAdmin"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubAdmin_clubId_userId_key" ON "ClubAdmin"("clubId", "userId");

-- CreateIndex
CREATE INDEX "ClubWorker_userId_idx" ON "ClubWorker"("userId");

-- CreateIndex
CREATE INDEX "ClubWorker_clubId_idx" ON "ClubWorker"("clubId");

-- CreateIndex
CREATE INDEX "ClubWorker_status_idx" ON "ClubWorker"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClubWorker_clubId_userId_key" ON "ClubWorker"("clubId", "userId");

-- CreateIndex
CREATE INDEX "Event_clubId_idx" ON "Event"("clubId");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventOccupancy_eventId_key" ON "EventOccupancy"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityMovement_idempotencyKey_key" ON "CapacityMovement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CapacityMovement_eventId_createdAt_idx" ON "CapacityMovement"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "CapacityMovement_actorUserId_createdAt_idx" ON "CapacityMovement"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CapacityMovement_ticketId_createdAt_idx" ON "CapacityMovement"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "CapacityMovement_workerShiftId_createdAt_idx" ON "CapacityMovement"("workerShiftId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerShift_workerId_status_startedAt_idx" ON "WorkerShift"("workerId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "WorkerShift_eventId_status_idx" ON "WorkerShift"("eventId", "status");

-- CreateIndex
CREATE INDEX "WorkerShift_status_lastActivityAt_idx" ON "WorkerShift"("status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "WorkerAuthorizedDevice_workerId_status_idx" ON "WorkerAuthorizedDevice"("workerId", "status");

-- CreateIndex
CREATE INDEX "WorkerAuthorizedDevice_fingerprint_status_idx" ON "WorkerAuthorizedDevice"("fingerprint", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerAuthorizedDevice_workerId_fingerprint_key" ON "WorkerAuthorizedDevice"("workerId", "fingerprint");

-- CreateIndex
CREATE INDEX "TicketType_clubId_idx" ON "TicketType"("clubId");

-- CreateIndex
CREATE INDEX "TicketType_eventId_idx" ON "TicketType"("eventId");

-- CreateIndex
CREATE INDEX "TicketType_status_idx" ON "TicketType"("status");

-- CreateIndex
CREATE INDEX "TicketType_clubId_eventId_idx" ON "TicketType"("clubId", "eventId");

-- CreateIndex
CREATE INDEX "Product_clubId_idx" ON "Product"("clubId");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_clubId_status_idx" ON "Product"("clubId", "status");

-- CreateIndex
CREATE INDEX "Promotion_clubId_idx" ON "Promotion"("clubId");

-- CreateIndex
CREATE INDEX "Promotion_eventId_idx" ON "Promotion"("eventId");

-- CreateIndex
CREATE INDEX "Promotion_status_idx" ON "Promotion"("status");

-- CreateIndex
CREATE INDEX "Promotion_clubId_status_idx" ON "Promotion"("clubId", "status");

-- CreateIndex
CREATE INDEX "Promotion_clubId_eventId_idx" ON "Promotion"("clubId", "eventId");

-- CreateIndex
CREATE INDEX "PromotionItem_promotionId_idx" ON "PromotionItem"("promotionId");

-- CreateIndex
CREATE INDEX "PromotionItem_productId_idx" ON "PromotionItem"("productId");

-- CreateIndex
CREATE INDEX "PromotionItem_ticketTypeId_idx" ON "PromotionItem"("ticketTypeId");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_clubId_idx" ON "Order"("clubId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "RefundRequest_clubId_status_createdAt_idx" ON "RefundRequest"("clubId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RefundRequest_orderId_createdAt_idx" ON "RefundRequest"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "RefundRequest_requestedByUserId_createdAt_idx" ON "RefundRequest"("requestedByUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClubOperationalProfile_clubId_key" ON "ClubOperationalProfile"("clubId");

-- CreateIndex
CREATE INDEX "InventoryReservation_resourceType_resourceId_status_expires_idx" ON "InventoryReservation"("resourceType", "resourceId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "InventoryReservation_orderId_status_idx" ON "InventoryReservation"("orderId", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_orderId_resourceType_resourceId_key" ON "InventoryReservation"("orderId", "resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "Cart_clubId_idx" ON "Cart"("clubId");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_itemType_itemId_idx" ON "CartItem"("itemType", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_itemType_itemId_key" ON "CartItem"("cartId", "itemType", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_walletTopUpId_key" ON "PaymentAttempt"("walletTopUpId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_externalPaymentId_key" ON "PaymentAttempt"("externalPaymentId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_createdAt_idx" ON "PaymentAttempt"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_walletTopUpId_idx" ON "PaymentAttempt"("walletTopUpId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_purpose_status_createdAt_idx" ON "PaymentAttempt"("purpose", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_idx" ON "PaymentAttempt"("status");

-- CreateIndex
CREATE INDEX "PaymentAttempt_expiresAt_idx" ON "PaymentAttempt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTopUp_idempotencyKey_key" ON "WalletTopUp"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletTopUp_userId_createdAt_idx" ON "WalletTopUp"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTopUp_walletId_createdAt_idx" ON "WalletTopUp"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTopUp_status_createdAt_idx" ON "WalletTopUp"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_paymentAttemptId_createdAt_idx" ON "PaymentProviderEvent"("paymentAttemptId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_status_idx" ON "PaymentProviderEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderEvent_provider_providerEventId_key" ON "PaymentProviderEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_itemType_itemId_idx" ON "OrderItem"("itemType", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_qrPayload_key" ON "Ticket"("qrPayload");

-- CreateIndex
CREATE INDEX "Ticket_ownerUserId_status_idx" ON "Ticket"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "Ticket_clubId_idx" ON "Ticket"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumableRight_code_key" ON "ConsumableRight"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumableRight_qrPayload_key" ON "ConsumableRight"("qrPayload");

-- CreateIndex
CREATE INDEX "ConsumableRight_ownerUserId_status_idx" ON "ConsumableRight"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "ConsumableRight_clubId_idx" ON "ConsumableRight"("clubId");

-- CreateIndex
CREATE INDEX "QrValidationAttempt_clubId_createdAt_idx" ON "QrValidationAttempt"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "QrValidationAttempt_resourceType_resourceId_createdAt_idx" ON "QrValidationAttempt"("resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "QrValidationAttempt_actorUserId_createdAt_idx" ON "QrValidationAttempt"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "QrValidationAttempt_outcome_createdAt_idx" ON "QrValidationAttempt"("outcome", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLogEntry_integrityHash_key" ON "AuditLogEntry"("integrityHash");

-- CreateIndex
CREATE INDEX "AuditLogEntry_actorUserId_createdAt_idx" ON "AuditLogEntry"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLogEntry_clubId_createdAt_idx" ON "AuditLogEntry"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLogEntry_resourceType_resourceId_idx" ON "AuditLogEntry"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLogEntry_action_idx" ON "AuditLogEntry"("action");

-- CreateIndex
CREATE INDEX "AuditLogEntry_severity_createdAt_idx" ON "AuditLogEntry"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLogEntry_correlationId_idx" ON "AuditLogEntry"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLogEntry_expiresAt_idx" ON "AuditLogEntry"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_objectKey_key" ON "Upload"("objectKey");

-- CreateIndex
CREATE INDEX "Upload_userId_idx" ON "Upload"("userId");

-- CreateIndex
CREATE INDEX "Upload_status_idx" ON "Upload"("status");

-- CreateIndex
CREATE INDEX "Upload_expiresAt_idx" ON "Upload"("expiresAt");

-- CreateIndex
CREATE INDEX "Upload_status_expiresAt_idx" ON "Upload"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PendingFileDeletion_objectKey_key" ON "PendingFileDeletion"("objectKey");

-- CreateIndex
CREATE INDEX "PendingFileDeletion_nextAttemptAt_idx" ON "PendingFileDeletion"("nextAttemptAt");

-- CreateIndex
CREATE INDEX "PendingFileDeletion_deletedAt_idx" ON "PendingFileDeletion"("deletedAt");

-- CreateIndex
CREATE INDEX "PendingFileDeletion_deletedAt_nextAttemptAt_idx" ON "PendingFileDeletion"("deletedAt", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletMovement" ADD CONSTRAINT "WalletMovement_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReferral" ADD CONSTRAINT "CustomerReferral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReferral" ADD CONSTRAINT "CustomerReferral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "CustomerReferral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletCreditLot" ADD CONSTRAINT "WalletCreditLot_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletCreditLot" ADD CONSTRAINT "WalletCreditLot_referralRewardId_fkey" FOREIGN KEY ("referralRewardId") REFERENCES "ReferralReward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletCreditConsumption" ADD CONSTRAINT "WalletCreditConsumption_creditLotId_fkey" FOREIGN KEY ("creditLotId") REFERENCES "WalletCreditLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletCreditConsumption" ADD CONSTRAINT "WalletCreditConsumption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransfer" ADD CONSTRAINT "WalletTransfer_fromWalletId_fkey" FOREIGN KEY ("fromWalletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransfer" ADD CONSTRAINT "WalletTransfer_toWalletId_fkey" FOREIGN KEY ("toWalletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransferAllocation" ADD CONSTRAINT "WalletTransferAllocation_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "WalletTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransferAllocation" ADD CONSTRAINT "WalletTransferAllocation_sourceCreditLotId_fkey" FOREIGN KEY ("sourceCreditLotId") REFERENCES "WalletCreditLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransferAllocation" ADD CONSTRAINT "WalletTransferAllocation_destinationCreditLotId_fkey" FOREIGN KEY ("destinationCreditLotId") REFERENCES "WalletCreditLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubFinancialProfile" ADD CONSTRAINT "ClubFinancialProfile_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneVerificationCode" ADD CONSTRAINT "PhoneVerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubAdmin" ADD CONSTRAINT "ClubAdmin_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubAdmin" ADD CONSTRAINT "ClubAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubWorker" ADD CONSTRAINT "ClubWorker_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubWorker" ADD CONSTRAINT "ClubWorker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOccupancy" ADD CONSTRAINT "EventOccupancy_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityMovement" ADD CONSTRAINT "CapacityMovement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerShift" ADD CONSTRAINT "WorkerShift_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "ClubWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerShift" ADD CONSTRAINT "WorkerShift_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAuthorizedDevice" ADD CONSTRAINT "WorkerAuthorizedDevice_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "ClubWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionItem" ADD CONSTRAINT "PromotionItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionItem" ADD CONSTRAINT "PromotionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionItem" ADD CONSTRAINT "PromotionItem_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubOperationalProfile" ADD CONSTRAINT "ClubOperationalProfile_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_walletTopUpId_fkey" FOREIGN KEY ("walletTopUpId") REFERENCES "WalletTopUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRight" ADD CONSTRAINT "ConsumableRight_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRight" ADD CONSTRAINT "ConsumableRight_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRight" ADD CONSTRAINT "ConsumableRight_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRight" ADD CONSTRAINT "ConsumableRight_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRight" ADD CONSTRAINT "ConsumableRight_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRight" ADD CONSTRAINT "ConsumableRight_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRight" ADD CONSTRAINT "ConsumableRight_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
