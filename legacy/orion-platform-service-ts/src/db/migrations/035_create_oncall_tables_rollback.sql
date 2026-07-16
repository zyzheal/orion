-- Rollback Migration 035_create_oncall_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: oncall_schedules
DROP TABLE IF EXISTS oncall_schedules CASCADE;

-- Dropping table: oncall_assignments
DROP TABLE IF EXISTS oncall_assignments CASCADE;

-- Dropping table: oncall_overrides
DROP TABLE IF EXISTS oncall_overrides CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_oncall_;
DROP INDEX IF EXISTS CREATE INDEX idx_oncall_a;
DROP INDEX IF EXISTS CREATE INDEX idx_oncall_a;
DROP INDEX IF EXISTS CREATE INDEX idx_oncall_a;
DROP INDEX IF EXISTS CREATE INDEX idx_oncall_override;
DROP INDEX IF EXISTS CREATE INDEX idx_oncall_override;
