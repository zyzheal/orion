-- Rollback Migration 009_create_code_repositories
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: code_repositories
DROP TABLE IF EXISTS code_repositories CASCADE;

-- Dropping table: pull_requests
DROP TABLE IF EXISTS pull_requests CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_code_repo;
DROP INDEX IF EXISTS CREATE INDEX idx_code_repo;
DROP INDEX IF EXISTS CREATE INDEX idx_pr;
DROP INDEX IF EXISTS CREATE INDEX idx_pr;
