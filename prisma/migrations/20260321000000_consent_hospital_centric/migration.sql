-- Rename pharmacy_id to hospital_id in consents table
-- Drop the old foreign key constraint first
ALTER TABLE "consents" DROP CONSTRAINT IF EXISTS "consents_pharmacy_id_fkey";

-- Rename the column
ALTER TABLE "consents" RENAME COLUMN "pharmacy_id" TO "hospital_id";

-- Re-add the foreign key constraint pointing to institutions
ALTER TABLE "consents" ADD CONSTRAINT "consents_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
