/*
  Warnings:

  - A unique constraint covering the columns `[walletTopUpId]` on the table `PaymentAttempt` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('ORDER_PAYMENT', 'WALLET_TOP_UP');

-- CreateEnum
CREATE TYPE "OrderPaymentMethod" AS ENUM ('FLOW', 'BEERRY_WALLET', 'SIMULATED');

-- CreateEnum
CREATE TYPE "WalletTopUpStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED', 'CHARGEDBACK');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" "OrderPaymentMethod" NOT NULL DEFAULT 'SIMULATED';

-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "purpose" "PaymentPurpose" NOT NULL DEFAULT 'ORDER_PAYMENT',
ADD COLUMN     "walletTopUpId" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;

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

-- CreateIndex
CREATE UNIQUE INDEX "WalletTopUp_idempotencyKey_key" ON "WalletTopUp"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletTopUp_userId_createdAt_idx" ON "WalletTopUp"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTopUp_walletId_createdAt_idx" ON "WalletTopUp"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTopUp_status_createdAt_idx" ON "WalletTopUp"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_walletTopUpId_key" ON "PaymentAttempt"("walletTopUpId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_walletTopUpId_idx" ON "PaymentAttempt"("walletTopUpId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_purpose_status_createdAt_idx" ON "PaymentAttempt"("purpose", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_walletTopUpId_fkey" FOREIGN KEY ("walletTopUpId") REFERENCES "WalletTopUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
