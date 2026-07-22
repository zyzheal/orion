-- Rollback Migration 131_execution_timelines
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: execution_timelines
DROP TABLE IF EXISTS execution_timelines CASCADE;

-- Dropping table: execution_events
DROP TABLE IF EXISTS execution_events CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_timeline_run ON execution_timeline;
DROP INDEX IF EXISTS CREATE INDEX idx_timeline_ta;
DROP INDEX IF EXISTS CREATE INDEX idx_timeline_tenant ON execution_timeline;
DROP INDEX IF EXISTS CREATE INDEX idx_timeline_;
DROP INDEX IF EXISTS CREATE INDEX idx_event_timeline ON execution_event;
DROP INDEX IF EXISTS CREATE INDEX idx_event_;
