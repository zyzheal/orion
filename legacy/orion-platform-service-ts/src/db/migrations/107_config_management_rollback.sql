-- Rollback Migration 107_config_management
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: config_change_requests
DROP TABLE IF EXISTS config_change_requests CASCADE;

-- Dropping table: config_drift_records
DROP TABLE IF EXISTS config_drift_records CASCADE;

-- Dropping table: remediation_logs
DROP TABLE IF EXISTS remediation_logs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_config_change_reque;
DROP INDEX IF EXISTS CREATE INDEX idx_config_change_reque;
DROP INDEX IF EXISTS CREATE INDEX idx_config_change_reque;
DROP INDEX IF EXISTS CREATE INDEX idx_config_change_reque;
DROP INDEX IF EXISTS CREATE INDEX idx_config_change_reque;
DROP INDEX IF EXISTS CREATE INDEX idx_config_drift_record;
DROP INDEX IF EXISTS CREATE INDEX idx_config_drift_record;
DROP INDEX IF EXISTS CREATE INDEX idx_config_drift_record;
DROP INDEX IF EXISTS CREATE INDEX idx_config_drift_record;
DROP INDEX IF EXISTS CREATE INDEX idx_config_drift_record;
DROP INDEX IF EXISTS CREATE INDEX idx_remediation_log;
DROP INDEX IF EXISTS CREATE INDEX idx_remediation_log;
DROP INDEX IF EXISTS CREATE INDEX idx_remediation_log;
DROP INDEX IF EXISTS CREATE INDEX idx_remediation_log;
DROP INDEX IF EXISTS CREATE INDEX idx_remediation_log;
