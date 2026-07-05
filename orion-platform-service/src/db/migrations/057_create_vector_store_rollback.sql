-- Rollback Migration 057_create_vector_store
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: vector_documents
DROP TABLE IF EXISTS vector_documents CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_vector_collection ON vector_document;
DROP INDEX IF EXISTS CREATE INDEX idx_vector_content_ha;
DROP INDEX IF EXISTS CREATE INDEX idx_vector_metadata ON vector_document;
DROP INDEX IF EXISTS -- For older ver;
DROP INDEX IF EXISTS CREATE INDEX idx_vector_embedding ON vector_document;
