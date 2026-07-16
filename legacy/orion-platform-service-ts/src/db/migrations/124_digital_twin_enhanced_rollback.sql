-- Rollback Migration 124_digital_twin_enhanced
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: twin_sandboxes
DROP TABLE IF EXISTS twin_sandboxes CASCADE;

-- Dropping table: traffic_recording_sessions
DROP TABLE IF EXISTS traffic_recording_sessions CASCADE;

-- Dropping table: traffic_replay_sessions
DROP TABLE IF EXISTS traffic_replay_sessions CASCADE;

-- Dropping table: twin_configs
DROP TABLE IF EXISTS twin_configs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_twin_;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_;
DROP INDEX IF EXISTS CREATE INDEX idx_traffic_recording_;
DROP INDEX IF EXISTS CREATE INDEX idx_traffic_recording_;
DROP INDEX IF EXISTS CREATE INDEX idx_traffic_recording_;
DROP INDEX IF EXISTS CREATE INDEX idx_traffic_replay_;
DROP INDEX IF EXISTS CREATE INDEX idx_traffic_replay_;
DROP INDEX IF EXISTS CREATE INDEX idx_traffic_replay_;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_config;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_config;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_config;
