-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('unsigned', 'signed');

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "digital_signature" TEXT,
ADD COLUMN     "signature_status" "SignatureStatus" NOT NULL DEFAULT 'unsigned',
ADD COLUMN     "signed_at" TIMESTAMP(3),
ADD COLUMN     "signed_by_id" UUID,
ADD COLUMN     "signed_data_hash" VARCHAR(64),
ADD COLUMN     "verify_token" VARCHAR(32);

-- CreateTable
CREATE TABLE "doctor_key_pairs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "public_key" VARCHAR(128) NOT NULL,
    "encrypted_private_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_key_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_key_pairs_user_id_key" ON "doctor_key_pairs"("user_id");

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_key_pairs" ADD CONSTRAINT "doctor_key_pairs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
