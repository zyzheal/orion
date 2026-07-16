-- Rollback Migration 064_code_ownership
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: code_owners
DROP TABLE IF EXISTS code_owners CASCADE;

DROP INDEX IF EXISTS idx_code_owner;
