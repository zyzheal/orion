-- Rollback 054: Drop event_bus tables

DROP INDEX IF EXISTS idx_event_bus_events_published;
DROP INDEX IF EXISTS idx_event_bus_events_status;
DROP INDEX IF EXISTS idx_event_bus_events_subject;
DROP INDEX IF EXISTS idx_event_bus_events_type;
DROP INDEX IF EXISTS idx_event_bus_events_tenant;
DROP TABLE IF EXISTS event_bus_events CASCADE;

DROP SEQUENCE IF EXISTS event_bus_seq;

DROP INDEX IF EXISTS idx_event_subscriptions_status;
DROP INDEX IF EXISTS idx_event_subscriptions_subject;
DROP INDEX IF EXISTS idx_event_subscriptions_tenant;
DROP TABLE IF EXISTS event_subscriptions CASCADE;

DROP TABLE IF EXISTS event_bus_config CASCADE;
