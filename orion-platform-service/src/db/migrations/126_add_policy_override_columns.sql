-- Migration 126: Add missing columns to policy_overrides_v2
-- Adds violation_id, approved_at, and scope columns to align with PolicyOverrideEntity model

ALTER TABLE policy_overrides_v2 ADD COLUMN IF NOT EXISTS violation_id VARCHAR(255);
ALTER TABLE policy_overrides_v2 ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE policy_overrides_v2 ADD COLUMN IF NOT EXISTS scope VARCHAR(50);

CREATE INDEX idx_policy_overrides_v2_violation ON policy_overrides_v2(violation_id);
