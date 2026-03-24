-- AlterTable
ALTER TABLE "patients" ALTER COLUMN "date_of_birth" TYPE TEXT USING to_char("date_of_birth", 'YYYY-MM-DD');
