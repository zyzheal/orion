-- Migration 055b: Add pending_fallback/pending_published status and retry columns to event_bus_events
-- Supports event replay when NATS recovers from fallback mode
-- C3 Fix: Added pending_published for race condition protection

ALTER TABLE event_bus_events
    ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP;

-- Update check constraint to include pending_published status
ALTER TABLE event_bus_events
    DROP CONSTRAINT IF EXISTS chk_event_status,
    ADD CONSTRAINT chk_event_status CHECK (status IN ('published', 'pending_fallback', 'pending_published', 'delivered', 'failed', 'dead_letter'));

-- Update any existing 'published' events that were created during fallback to 'pending_fallback'
-- (This is a safety net; normally the service sets the correct status)
-- UPDATE event_bus_events SET status = 'pending_fallback' WHERE status = 'published' AND created_at > (NOW() - INTERVAL '1 hour');

CREATE INDEX IF NOT EXISTS idx_event_bus_events_retry ON event_bus_events(status, retry_count) WHERE status = 'pending_fallback';
