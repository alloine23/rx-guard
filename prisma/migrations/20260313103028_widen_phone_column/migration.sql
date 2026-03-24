/*
  Warnings:

  - You are about to drop the column `embedding` on the `image_hashes` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "image_hashes_embedding_idx";

-- AlterTable
ALTER TABLE "image_hashes" DROP COLUMN "embedding";

-- AlterTable
ALTER TABLE "patients" ALTER COLUMN "phone" SET DATA TYPE TEXT;
