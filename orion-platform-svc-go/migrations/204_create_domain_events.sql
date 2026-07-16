-- Migration: Create domain_events table for event sourcing
-- Stores all domain events for aggregate reconstruction

CREATE TABLE IF NOT EXISTS domain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    version INTEGER NOT NULL,
    correlation_id UUID,
    causation_id UUID,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(aggregate_id, version)
);

CREATE INDEX IF NOT EXISTS idx_domain_events_tenant ON domain_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events(aggregate_id, version);
CREATE INDEX IF NOT EXISTS idx_domain_events_occurred ON domain_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_type ON domain_events(aggregate_type, tenant_id);
