-- Rollback Migration 154_pipeline_rbac_and_rls
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: pipeline_rbac_rules
DROP TABLE IF EXISTS pipeline_rbac_rules CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_rbac_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_rbac_rule;
DROP INDEX IF EXISTS idx_role;
DROP INDEX IF EXISTS idx_u;
DROP INDEX IF EXISTS idx_role_permi;
