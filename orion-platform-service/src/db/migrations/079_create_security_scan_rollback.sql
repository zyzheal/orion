-- Rollback Migration 079_create_security_scan
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: security_scans
DROP TABLE IF EXISTS security_scans CASCADE;

-- Dropping table: security_findings
DROP TABLE IF EXISTS security_findings CASCADE;

-- Dropping table: risk_predictions
DROP TABLE IF EXISTS risk_predictions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_ri;
DROP INDEX IF EXISTS CREATE INDEX idx_ri;
DROP INDEX IF EXISTS CREATE INDEX idx_ri;
DROP INDEX IF EXISTS CREATE INDEX idx_ri;
DROP INDEX IF EXISTS CREATE INDEX idx_ri;
