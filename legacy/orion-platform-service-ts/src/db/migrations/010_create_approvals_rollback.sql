-- Rollback Migration 010_create_approvals
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: approval_definitions
DROP TABLE IF EXISTS approval_definitions CASCADE;

-- Dropping table: approvals
DROP TABLE IF EXISTS approvals CASCADE;

-- Dropping table: approval_steps
DROP TABLE IF EXISTS approval_steps CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_approval_def;
DROP INDEX IF EXISTS CREATE INDEX idx_approval;
DROP INDEX IF EXISTS CREATE INDEX idx_approval;
DROP INDEX IF EXISTS CREATE INDEX idx_approval;
DROP INDEX IF EXISTS CREATE INDEX idx_approval_;
