-- Rollback Migration 084_create_digital_twin
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: twin_snapshots
DROP TABLE IF EXISTS twin_snapshots CASCADE;

-- Dropping table: traffic_recordings
DROP TABLE IF EXISTS traffic_recordings CASCADE;

-- Dropping table: traffic_replays
DROP TABLE IF EXISTS traffic_replays CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_twin_;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_;
DROP INDEX IF EXISTS CREATE INDEX idx_twin_;
DROP INDEX IF EXISTS CREATE INDEX idx_traffic_recording;
DROP INDEX IF EXISTS CREATE INDEX idx_traffic_recording;
DROP INDEX IF EXISTS CREATE INDEX idx_traffic_replay;
DROP INDEX IF EXISTS CREATE INDEX idx_traffic_replay;
