-- Rollback Migration 028_create_change_intelligence_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: change_intelligence_reports
DROP TABLE IF EXISTS change_intelligence_reports CASCADE;

-- Dropping table: change_intelligence_affected_services
DROP TABLE IF EXISTS change_intelligence_affected_services CASCADE;

-- Dropping table: change_intelligence_risk_factors
DROP TABLE IF EXISTS change_intelligence_risk_factors CASCADE;

-- Dropping table: change_intelligence_historical_matches
DROP TABLE IF EXISTS change_intelligence_historical_matches CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_ci_report;
DROP INDEX IF EXISTS CREATE INDEX idx_ci_report;
DROP INDEX IF EXISTS CREATE INDEX idx_ci_affected_;
DROP INDEX IF EXISTS CREATE INDEX idx_ci_affected_;
DROP INDEX IF EXISTS CREATE INDEX idx_ci_ri;
DROP INDEX IF EXISTS CREATE INDEX idx_ci_hi;
DROP INDEX IF EXISTS CREATE INDEX idx_ci_hi;
