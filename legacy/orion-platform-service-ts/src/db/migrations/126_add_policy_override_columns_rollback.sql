-- Rollback Migration 126_add_policy_override_columns
-- Auto-generated rollback script
-- Review carefully before executing in production

DROP INDEX IF EXISTS CREATE INDEX idx_policy_override;
