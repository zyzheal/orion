-- Reverse 606_create_eventbus_missing_tables.sql.
DROP INDEX IF EXISTS idx_events_causation_id;
DROP INDEX IF EXISTS idx_events_correlation_id;
ALTER TABLE events DROP COLUMN IF EXISTS causation_id;
ALTER TABLE events DROP COLUMN IF EXISTS correlation_id;
