-- Migration: 238_add_event_correlation_id
-- Description: Add CorrelationID/CausationID for distributed tracing (P1-2)
-- Module: eventbus

ALTER TABLE IF EXISTS events ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE IF EXISTS events ADD COLUMN IF NOT EXISTS causation_id UUID;

CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_causation_id ON events(causation_id);
