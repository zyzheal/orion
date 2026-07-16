-- Rollback Migration 012_create_monitoring_alerts
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: monitoring_configs
DROP TABLE IF EXISTS monitoring_configs CASCADE;

-- Dropping table: alerts
DROP TABLE IF EXISTS alerts CASCADE;

-- Dropping table: alert_correlations
DROP TABLE IF EXISTS alert_correlations CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_monitoring_config;
DROP INDEX IF EXISTS CREATE INDEX idx_alert;
DROP INDEX IF EXISTS CREATE INDEX idx_alert;
DROP INDEX IF EXISTS CREATE INDEX idx_alert;
DROP INDEX IF EXISTS CREATE INDEX idx_alert;
