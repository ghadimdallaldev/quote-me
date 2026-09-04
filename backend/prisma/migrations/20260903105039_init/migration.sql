-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPS_MANAGER');

-- CreateEnum
CREATE TYPE "MenuUnit" AS ENUM ('BOX', 'DOZEN', 'PORTION', 'PIECE', 'KG', 'CAKE', 'SHOT', 'JAR', 'PERSON');

-- CreateEnum
CREATE TYPE "CalcMethod" AS ENUM ('PER_GUEST_PER_VARIETY', 'DISTRIBUTED_ACROSS_VARIETIES', 'FIXED_UNIT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "QuantityRuleScope" AS ENUM ('CATEGORY', 'ITEM', 'VARIANT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "LineMode" AS ENUM ('PACKAGE', 'A_LA_CARTE', 'GUEST_BASED');

-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('FIXED', 'PERCENT', 'DELIVERY', 'SETUP', 'SERVICE', 'TAX', 'CUSTOM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPS_MANAGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "defaultCalcMethod" "CalcMethod",

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuSubcategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuSubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "servingInfo" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemVariant" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "unit" "MenuUnit" NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "minimumQuantity" INTEGER,
    "roundingIncrement" INTEGER,
    "piecesPerUnit" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "MenuItemVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuPackage" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "unit" "MenuUnit" NOT NULL DEFAULT 'BOX',
    "totalPieces" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "MenuPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuPackageComponent" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER,
    "unit" TEXT,
    "groupName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCustomizable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MenuPackageComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuantityRule" (
    "id" TEXT NOT NULL,
    "scope" "QuantityRuleScope" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "method" "CalcMethod" NOT NULL,
    "quantityPerGuest" DOUBLE PRECISION,
    "totalPiecesPerGuest" DOUBLE PRECISION,
    "roundingIncrement" INTEGER,
    "minimumQuantity" INTEGER,
    "notes" TEXT,

    CONSTRAINT "QuantityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "clientId" TEXT,
    "createdById" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "eventDate" TIMESTAMP(3),
    "eventTime" TEXT,
    "eventLocation" TEXT,
    "guestCount" INTEGER,
    "waiterCount" INTEGER,
    "eventType" TEXT,
    "notes" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "chargesCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "grandTotalCents" INTEGER NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "terms" TEXT,
    "paymentTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "lineMode" "LineMode" NOT NULL,
    "menuItemId" TEXT,
    "menuVariantId" TEXT,
    "menuPackageId" TEXT,
    "unitSnapshot" TEXT NOT NULL,
    "orderNameSnapshot" TEXT NOT NULL,
    "categorySnapshot" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "lineTotalCents" INTEGER NOT NULL,
    "noteSnapshot" TEXT,
    "wasAutoCalculated" BOOLEAN NOT NULL DEFAULT false,
    "calcExplanation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItemComponent" (
    "id" TEXT NOT NULL,
    "quotationItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER,
    "unit" TEXT,
    "groupName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationItemComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationCharge" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChargeType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCatalog_code_key" ON "MenuCatalog"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_catalogId_slug_key" ON "MenuCategory"("catalogId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "MenuSubcategory_categoryId_slug_key" ON "MenuSubcategory"("categoryId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_categoryId_slug_key" ON "MenuItem"("categoryId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemVariant_menuItemId_slug_key" ON "MenuItemVariant"("menuItemId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "MenuPackage_catalogId_slug_key" ON "MenuPackage"("catalogId", "slug");

-- CreateIndex
CREATE INDEX "QuantityRule_scope_scopeId_idx" ON "QuantityRule"("scope", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quotationNumber_key" ON "Quotation"("quotationNumber");

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "MenuCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuSubcategory" ADD CONSTRAINT "MenuSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "MenuSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemVariant" ADD CONSTRAINT "MenuItemVariant_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuPackage" ADD CONSTRAINT "MenuPackage_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "MenuCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuPackage" ADD CONSTRAINT "MenuPackage_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuPackageComponent" ADD CONSTRAINT "MenuPackageComponent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "MenuPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItemComponent" ADD CONSTRAINT "QuotationItemComponent_quotationItemId_fkey" FOREIGN KEY ("quotationItemId") REFERENCES "QuotationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationCharge" ADD CONSTRAINT "QuotationCharge_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
