-- Migration 003: Align event_logs with TS EventBusEventEntity
-- Adds sequence tracking and retry fields for dual-write coexistence
-- Also creates event_bus_config table for cross-language compatibility

-- Add sequence tracking to event_logs (aligned with TS event_bus_events)
ALTER TABLE event_logs
    ADD COLUMN IF NOT EXISTS sequence_num BIGINT,
    ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- Create event_bus_config table (aligned with TS event_bus_config)
CREATE TABLE IF NOT EXISTS event_bus_config (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for event_logs new columns
CREATE INDEX IF NOT EXISTS idx_event_logs_sequence ON event_logs(sequence_num);
CREATE INDEX IF NOT EXISTS idx_event_logs_retry ON event_logs(retry_count) WHERE retry_count > 0;
CREATE INDEX IF NOT EXISTS idx_event_bus_config_key ON event_bus_config(config_key);

-- Insert default config entries
INSERT INTO event_bus_config (config_key, config_value, description)
VALUES ('nats_max_retry', '3', 'Maximum retry count for pending events')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO event_bus_config (config_key, config_value, description)
VALUES ('nats_retry_interval_sec', '30', 'Interval between retry attempts in seconds')
ON CONFLICT (config_key) DO NOTHING;
