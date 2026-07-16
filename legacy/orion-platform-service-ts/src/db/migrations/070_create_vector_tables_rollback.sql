-- Rollback Migration 070_create_vector_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: code_embeddings
DROP TABLE IF EXISTS code_embeddings CASCADE;

-- Dropping table: knowledge_embeddings
DROP TABLE IF EXISTS knowledge_embeddings CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_code_embedding;
DROP INDEX IF EXISTS CREATE INDEX idx_code_embedding;
DROP INDEX IF EXISTS CREATE INDEX idx_code_embedding;
DROP INDEX IF EXISTS CREATE INDEX idx_code_embedding;
DROP INDEX IF EXISTS CREATE INDEX idx_code_embedding;
DROP INDEX IF EXISTS CREATE INDEX idx_knowledge_embedding;
DROP INDEX IF EXISTS CREATE INDEX idx_knowledge_embedding;
DROP INDEX IF EXISTS CREATE INDEX idx_knowledge_embedding;
DROP INDEX IF EXISTS CREATE INDEX idx_knowledge_embedding;
