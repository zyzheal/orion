-- Rollback Migration 126: Remove added columns from policy_overrides_v2

DROP INDEX IF EXISTS idx_policy_overrides_v2_violation;
ALTER TABLE policy_overrides_v2 DROP COLUMN IF EXISTS scope;
ALTER TABLE policy_overrides_v2 DROP COLUMN IF EXISTS approved_at;
ALTER TABLE policy_overrides_v2 DROP COLUMN IF EXISTS violation_id;
