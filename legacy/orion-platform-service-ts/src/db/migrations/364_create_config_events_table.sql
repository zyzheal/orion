-- Migration: 364_create_config_events_table.sql
-- Purpose: Persist config change event bus history to PostgreSQL

CREATE TABLE IF NOT EXISTS config_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(50) NOT NULL,
    domain          VARCHAR(100) NOT NULL,
    key             VARCHAR(200) NOT NULL,
    changed_by      VARCHAR(100) NOT NULL,
    old_value       JSONB,
    new_value       JSONB,
    version         INTEGER DEFAULT 1,
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_events_type ON config_events(event_type);
CREATE INDEX IF NOT EXISTS idx_config_events_domain ON config_events(domain);
CREATE INDEX IF NOT EXISTS idx_config_events_created ON config_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_events_tenant ON config_events(tenant_id);
