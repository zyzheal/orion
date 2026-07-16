-- Rollback Migration 062_create_branch_policies
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: branch_policies
DROP TABLE IF EXISTS branch_policies CASCADE;

DROP INDEX IF EXISTS idx_branch_policie;
DROP INDEX IF EXISTS idx_branch_policie;
