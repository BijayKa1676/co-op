-- Migration: Add vector_id column to user_document_chunks for Upstash Vector integration
-- This enables semantic search on user-uploaded documents

ALTER TABLE user_document_chunks 
ADD COLUMN IF NOT EXISTS vector_id VARCHAR(255);

-- Index for faster lookups by vector_id
CREATE INDEX IF NOT EXISTS idx_user_document_chunks_vector_id 
ON user_document_chunks(vector_id) 
WHERE vector_id IS NOT NULL;

COMMENT ON COLUMN user_document_chunks.vector_id IS 'Upstash Vector ID for semantic search (format: user_{document_id}_{chunk_index})';
