-- AlterTable
ALTER TABLE "consents" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "rejection_reason" TEXT;
