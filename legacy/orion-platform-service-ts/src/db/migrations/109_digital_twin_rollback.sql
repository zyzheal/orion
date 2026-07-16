-- Rollback Migration 109_digital_twin
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: twin_configurations
DROP TABLE IF EXISTS twin_configurations CASCADE;

-- Dropping table: twin_snapshots
DROP TABLE IF EXISTS twin_snapshots CASCADE;

-- Dropping table: twin_replay_logs
DROP TABLE IF EXISTS twin_replay_logs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_twin_configuration;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_configuration;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_configuration;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_configuration;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_replay_log;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_replay_log;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_replay_log;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_replay_log;
