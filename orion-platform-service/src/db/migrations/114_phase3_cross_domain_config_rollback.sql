-- Rollback Migration 114_phase3_cross_domain_config
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: cross_domain_orchestrations
DROP TABLE IF EXISTS cross_domain_orchestrations CASCADE;

-- Dropping table: cross_domain_orchestration_steps
DROP TABLE IF EXISTS cross_domain_orchestration_steps CASCADE;

-- Dropping table: domain_connectors
DROP TABLE IF EXISTS domain_connectors CASCADE;

-- Dropping table: cross_domain_transactions
DROP TABLE IF EXISTS cross_domain_transactions CASCADE;

-- Dropping table: config_change_requests_enhanced
DROP TABLE IF EXISTS config_change_requests_enhanced CASCADE;

-- Dropping table: config_change_history
DROP TABLE IF EXISTS config_change_history CASCADE;

-- Dropping table: config_drift_reports
DROP TABLE IF EXISTS config_drift_reports CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_orche;
DROP INDEX IF EXISTS CREATE INDEX idx_orche;
DROP INDEX IF EXISTS CREATE INDEX idx_orche;
DROP INDEX IF EXISTS CREATE INDEX idx_orche;
DROP INDEX IF EXISTS CREATE INDEX idx_orche;
DROP INDEX IF EXISTS CREATE INDEX idx_orche;
DROP INDEX IF EXISTS CREATE INDEX idx_domain_connector;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_config_change_req;
DROP INDEX IF EXISTS CREATE INDEX idx_config_change_req;
DROP INDEX IF EXISTS CREATE INDEX idx_config_change_req;
DROP INDEX IF EXISTS CREATE INDEX idx_config_change_req;
DROP INDEX IF EXISTS CREATE INDEX idx_config_change_hi;
DROP INDEX IF EXISTS CREATE INDEX idx_config_change_hi;
DROP INDEX IF EXISTS CREATE INDEX idx_config_change_hi;
DROP INDEX IF EXISTS CREATE INDEX idx_config_drift_report;
DROP INDEX IF EXISTS CREATE INDEX idx_config_drift_report;
DROP INDEX IF EXISTS CREATE INDEX idx_config_drift_report;
