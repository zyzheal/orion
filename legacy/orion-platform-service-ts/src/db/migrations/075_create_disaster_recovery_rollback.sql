-- Rollback Migration 075_create_disaster_recovery
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: disaster_recovery_config
DROP TABLE IF EXISTS disaster_recovery_config CASCADE;

-- Dropping table: disaster_recovery_events
DROP TABLE IF EXISTS disaster_recovery_events CASCADE;

-- Dropping table: disaster_recovery_health_checks
DROP TABLE IF EXISTS disaster_recovery_health_checks CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_dr_config_component ON di;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_config_;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_config_enabled ON di;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_config_primary_;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_event;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_event;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_event;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_event;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_event;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_health_check;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_health_check;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_health_check;
