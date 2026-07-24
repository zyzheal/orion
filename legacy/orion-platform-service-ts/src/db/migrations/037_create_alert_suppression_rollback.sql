-- Rollback Migration 037_create_alert_suppression
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: alert_suppression_rules
DROP TABLE IF EXISTS alert_suppression_rules CASCADE;

-- Dropping table: maintenance_windows
DROP TABLE IF EXISTS maintenance_windows CASCADE;

-- Dropping table: known_issues
DROP TABLE IF EXISTS known_issues CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_alert_;
DROP INDEX IF EXISTS CREATE INDEX idx_alert_;
DROP INDEX IF EXISTS CREATE INDEX idx_maintenance_window;
DROP INDEX IF EXISTS CREATE INDEX idx_maintenance_window;
DROP INDEX IF EXISTS CREATE INDEX idx_known_i;
DROP INDEX IF EXISTS CREATE INDEX idx_known_i;
