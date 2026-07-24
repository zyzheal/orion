-- Rollback Migration 023_create_knowledge
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: knowledge_categories
DROP TABLE IF EXISTS knowledge_categories CASCADE;

-- Dropping table: knowledge_articles
DROP TABLE IF EXISTS knowledge_articles CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_kb_categorie;
DROP INDEX IF EXISTS CREATE INDEX idx_kb_article;
DROP INDEX IF EXISTS CREATE INDEX idx_kb_article;
DROP INDEX IF EXISTS CREATE INDEX idx_kb_article;
