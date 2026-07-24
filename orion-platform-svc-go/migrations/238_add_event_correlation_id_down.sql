-- Migration: 238_add_event_correlation_id_down
-- Module: eventbus

DROP INDEX IF EXISTS idx_events_correlation_id;
DROP INDEX IF EXISTS idx_events_causation_id;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS correlation_id;
ALTER TABLE IF EXISTS events DROP COLUMN IF EXISTS causation_id;
