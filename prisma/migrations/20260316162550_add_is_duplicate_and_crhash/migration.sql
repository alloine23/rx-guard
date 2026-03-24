-- AlterTable
ALTER TABLE "image_hashes" ADD COLUMN     "crhash" VARCHAR(512);

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "is_duplicate" BOOLEAN NOT NULL DEFAULT false;
