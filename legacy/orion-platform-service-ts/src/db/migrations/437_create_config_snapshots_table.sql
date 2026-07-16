-- Migration 437: Create config_snapshots table for ConfigSnapshotService

-- Per-config snapshot support: each row captures one config entry state at a point in time.
-- Uses IF NOT EXISTS for idempotency — existing deployments using ConfigVersionRepository
-- may already have this table with a slightly different schema (tenant_id vs config_id).

CREATE TABLE IF NOT EXISTS config_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_snapshots_config ON config_snapshots(config_id);
CREATE INDEX IF NOT EXISTS idx_config_snapshots_created ON config_snapshots(created_at);
