-- Allow fractional quotation line quantities (e.g. 7.5 dozen)
ALTER TABLE "QuotationItem" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;
