-- CreateEnum
CREATE TYPE "ProductDeliveryMode" AS ENUM ('GROUPED', 'SEPARATE');

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN "combineProducts" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN "productDeliveryMode" "ProductDeliveryMode" NOT NULL DEFAULT 'GROUPED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "combineProducts" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "productDeliveryMode" "ProductDeliveryMode" NOT NULL DEFAULT 'GROUPED';

-- CreateTable
CREATE TABLE "ProductDelivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "signatureVersion" TEXT NOT NULL DEFAULT 'v1',
    "status" "RedeemableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDeliveryItem" (
    "id" TEXT NOT NULL,
    "productDeliveryId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ProductDeliveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductDelivery_code_key" ON "ProductDelivery"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDelivery_qrPayload_key" ON "ProductDelivery"("qrPayload");

-- CreateIndex
CREATE INDEX "ProductDelivery_ownerUserId_status_idx" ON "ProductDelivery"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "ProductDelivery_clubId_idx" ON "ProductDelivery"("clubId");

-- CreateIndex
CREATE INDEX "ProductDelivery_orderId_idx" ON "ProductDelivery"("orderId");

-- CreateIndex
CREATE INDEX "ProductDeliveryItem_productDeliveryId_idx" ON "ProductDeliveryItem"("productDeliveryId");

-- CreateIndex
CREATE INDEX "ProductDeliveryItem_orderItemId_idx" ON "ProductDeliveryItem"("orderItemId");

-- CreateIndex
CREATE INDEX "ProductDeliveryItem_productId_idx" ON "ProductDeliveryItem"("productId");

-- AddForeignKey
ALTER TABLE "ProductDelivery" ADD CONSTRAINT "ProductDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDelivery" ADD CONSTRAINT "ProductDelivery_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDelivery" ADD CONSTRAINT "ProductDelivery_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDeliveryItem" ADD CONSTRAINT "ProductDeliveryItem_productDeliveryId_fkey" FOREIGN KEY ("productDeliveryId") REFERENCES "ProductDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDeliveryItem" ADD CONSTRAINT "ProductDeliveryItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDeliveryItem" ADD CONSTRAINT "ProductDeliveryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
