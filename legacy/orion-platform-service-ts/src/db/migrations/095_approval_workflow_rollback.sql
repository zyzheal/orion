-- Rollback Migration 095_approval_workflow
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: approval_requests
DROP TABLE IF EXISTS approval_requests CASCADE;

-- Dropping table: approval_templates
DROP TABLE IF EXISTS approval_templates CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_approval_reque;
DROP INDEX IF EXISTS CREATE INDEX idx_approval_reque;
DROP INDEX IF EXISTS CREATE INDEX idx_approval_reque;
DROP INDEX IF EXISTS CREATE INDEX idx_approval_reque;
DROP INDEX IF EXISTS CREATE INDEX idx_approval_reque;
DROP INDEX IF EXISTS CREATE INDEX idx_approval_template;
DROP INDEX IF EXISTS CREATE INDEX idx_approval_template;
DROP INDEX IF EXISTS CREATE INDEX idx_approval_template;
DROP INDEX IF EXISTS idx_approval_reque;
DROP INDEX IF EXISTS idx_approval_template;
