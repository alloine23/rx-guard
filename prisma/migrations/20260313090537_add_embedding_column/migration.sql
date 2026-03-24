-- Add pgvector embedding column for image deduplication
ALTER TABLE "image_hashes" ADD COLUMN "embedding" vector(512);
CREATE INDEX "image_hashes_embedding_idx" ON "image_hashes" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);