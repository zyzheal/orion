-- Rollback Migration 054_create_event_bus_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: event_bus_config
DROP TABLE IF EXISTS event_bus_config CASCADE;

-- Dropping table: event_subscriptions
DROP TABLE IF EXISTS event_subscriptions CASCADE;

-- Dropping table: event_bus_events
DROP TABLE IF EXISTS event_bus_events CASCADE;

DROP INDEX IF EXISTS idx_event_;
DROP INDEX IF EXISTS idx_event_;
DROP INDEX IF EXISTS idx_event_;
DROP INDEX IF EXISTS idx_event_bu;
DROP INDEX IF EXISTS idx_event_bu;
DROP INDEX IF EXISTS idx_event_bu;
DROP INDEX IF EXISTS idx_event_bu;
DROP INDEX IF EXISTS idx_event_bu;
