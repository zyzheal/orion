-- Rollback Migration 122_create_policy_override_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: policy_overrides_v2
DROP TABLE IF EXISTS policy_overrides_v2 CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_policy_override;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_override;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_override;
