-- Rollback Migration 149_create_risk_reports_and_twin_snapshots
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: risk_reports
DROP TABLE IF EXISTS risk_reports CASCADE;

-- Dropping table: digital_twin_snapshots
DROP TABLE IF EXISTS digital_twin_snapshots CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_ri;
DROP INDEX IF EXISTS CREATE INDEX idx_ri;
DROP INDEX IF EXISTS CREATE INDEX idx_ri;
DROP INDEX IF EXISTS CREATE INDEX idx_ri;
DROP INDEX IF EXISTS CREATE INDEX idx_digital_twin_;
DROP INDEX IF EXISTS CREATE INDEX idx_digital_twin_;
DROP INDEX IF EXISTS CREATE INDEX idx_digital_twin_;
