-- Rollback Migration 086_quality_gate_enhancement
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: policy_overrides
DROP TABLE IF EXISTS policy_overrides CASCADE;

-- Dropping table: policy_exemptions
DROP TABLE IF EXISTS policy_exemptions CASCADE;

-- Dropping table: quality_gate_snapshots
DROP TABLE IF EXISTS quality_gate_snapshots CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_policy_override;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_override;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_override;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_override;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_exemption;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_exemption;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_exemption;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_exemption;
DROP INDEX IF EXISTS CREATE INDEX idx_quality_gate_;
DROP INDEX IF EXISTS CREATE INDEX idx_quality_gate_;
DROP INDEX IF EXISTS CREATE INDEX idx_quality_gate_;
DROP INDEX IF EXISTS CREATE INDEX idx_quality_gate_;
DROP INDEX IF EXISTS CREATE INDEX idx_quality_gate_;
DROP INDEX IF EXISTS idx_policy_override;
DROP INDEX IF EXISTS idx_policy_exemption;
DROP INDEX IF EXISTS idx_quality_gate_;
