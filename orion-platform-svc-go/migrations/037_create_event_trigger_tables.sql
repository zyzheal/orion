-- Migration: 001_create_event_trigger_tables.sql
-- Description: Create tables for event triggers
-- Module: event-trigger

CREATE TABLE IF NOT EXISTS event_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_event_triggers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_triggers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_triggers_tenant_id ON event_triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_triggers_event_type ON event_triggers(event_type);

CREATE OR REPLACE FUNCTION update_event_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_event_triggers_updated_at
    BEFORE UPDATE ON event_triggers
    FOR EACH ROW
    EXECUTE FUNCTION update_event_triggers_updated_at();
