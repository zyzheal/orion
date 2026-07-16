-- Migration: Create domain_snapshots table for event sourcing
-- Stores periodic snapshots to reduce event replay cost

CREATE TABLE IF NOT EXISTS domain_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    snapshot_version INTEGER NOT NULL,
    snapshot_data JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(aggregate_id, snapshot_version)
);

CREATE INDEX IF NOT EXISTS idx_domain_snapshots_tenant ON domain_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domain_snapshots_aggregate ON domain_snapshots(aggregate_id, snapshot_version DESC);
