-- Rollback Migration 052_create_knowledge_base
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: kb_spaces
DROP TABLE IF EXISTS kb_spaces CASCADE;

-- Dropping table: kb_docs
DROP TABLE IF EXISTS kb_docs CASCADE;

-- Dropping table: kb_doc_versions
DROP TABLE IF EXISTS kb_doc_versions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_kb_;
DROP INDEX IF EXISTS CREATE INDEX idx_kb_;
DROP INDEX IF EXISTS CREATE INDEX idx_kb_doc;
DROP INDEX IF EXISTS CREATE INDEX idx_kb_doc;
DROP INDEX IF EXISTS CREATE INDEX idx_kb_doc;
DROP INDEX IF EXISTS CREATE INDEX idx_kb_doc;
DROP INDEX IF EXISTS CREATE INDEX idx_kb_doc_ver;
