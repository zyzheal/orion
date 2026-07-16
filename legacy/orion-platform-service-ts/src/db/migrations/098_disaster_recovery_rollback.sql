-- Rollback Migration 098_disaster_recovery
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: disaster_recovery_plans
DROP TABLE IF EXISTS disaster_recovery_plans CASCADE;

-- Dropping table: dr_failover_tests
DROP TABLE IF EXISTS dr_failover_tests CASCADE;

-- Dropping table: backup_configs
DROP TABLE IF EXISTS backup_configs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_di;
DROP INDEX IF EXISTS CREATE INDEX idx_di;
DROP INDEX IF EXISTS CREATE INDEX idx_di;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_failover_te;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_failover_te;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_failover_te;
DROP INDEX IF EXISTS CREATE INDEX idx_dr_failover_te;
DROP INDEX IF EXISTS CREATE INDEX idx_backup_config;
DROP INDEX IF EXISTS CREATE INDEX idx_backup_config;
DROP INDEX IF EXISTS CREATE INDEX idx_backup_config;
