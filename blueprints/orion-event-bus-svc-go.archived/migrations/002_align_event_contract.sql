-- Migration 002: Align event_logs schema with TS EventBusEventEntity
-- Adds CloudEvents fields and status enum for cross-language compatibility
-- Required for 6.27 EventBus event contract alignment

-- Add subject, source, status, published_by, published_at columns
ALTER TABLE event_logs
    ADD COLUMN IF NOT EXISTS subject VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source VARCHAR(200) DEFAULT 'orion-event-bus-svc',
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending_published',
    ADD COLUMN IF NOT EXISTS published_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Migrate existing data: processed=true → status=delivered, processed=false → status=pending_published
UPDATE event_logs
SET status = CASE WHEN processed = true THEN 'delivered' ELSE 'pending_published' END,
    published_at = created_at
WHERE status IS NULL;

-- Add status constraint (aligned with TS event_bus_events)
ALTER TABLE event_logs
    ADD CONSTRAINT chk_event_status CHECK (status IN ('published', 'pending_fallback', 'pending_published', 'delivered', 'failed', 'dead_letter'));

-- Backfill source for existing events
UPDATE event_logs SET source = 'orion-event-bus-svc' WHERE source IS NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_event_logs_status ON event_logs(status);
CREATE INDEX IF NOT EXISTS idx_event_logs_source ON event_logs(source);
