-- CMDB Collector: adapter catalog, discovery jobs, and asset inventory tables.
--
-- Migration number: 001 (local to cmdb-collector; use as reference when
-- numbering the global migration sequence).
--
-- Tables:
--   cmdb_adapters        — registered collector adapter instances (tenant-scoped)
--   cmdb_discovery_jobs  — audit trail of every discovery run
--   cmdb_assets          — normalised inventory produced by discovery sweeps
--
-- Rollback: 001_create_cmdb_tables_down.sql

-- ===================================================================
-- cmdb_adapters — adapter catalog
-- ===================================================================

CREATE TABLE IF NOT EXISTS cmdb_adapters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        VARCHAR(255) NOT NULL,
    category    VARCHAR(50) NOT NULL,   -- "cloud" | "network" | "database" | "middleware" | "os" | "app"
    vendor      VARCHAR(255) NOT NULL,
    description TEXT,
    config      JSONB DEFAULT '{}',     -- vendor-specific connection config
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cmdb_adapters_tenant_id ON cmdb_adapters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_adapters_tenant_name ON cmdb_adapters(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_cmdb_adapters_category ON cmdb_adapters(category);
CREATE INDEX IF NOT EXISTS idx_cmdb_adapters_enabled ON cmdb_adapters(enabled);

-- ===================================================================
-- cmdb_discovery_jobs — discovery job audit trail
-- ===================================================================

CREATE TABLE IF NOT EXISTS cmdb_discovery_jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    adapter_id    UUID NOT NULL REFERENCES cmdb_adapters(id) ON DELETE CASCADE,
    target        VARCHAR(255) NOT NULL,
    status        VARCHAR(50) NOT NULL DEFAULT 'pending',  -- "pending" | "running" | "completed" | "failed"
    result_count  INT NOT NULL DEFAULT 0,
    error         TEXT,
    started_at    TIMESTAMP WITH TIME ZONE,
    finished_at   TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cmdb_discovery_jobs_tenant_id ON cmdb_discovery_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_discovery_jobs_adapter_id ON cmdb_discovery_jobs(adapter_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_discovery_jobs_status ON cmdb_discovery_jobs(status);
CREATE INDEX IF NOT EXISTS idx_cmdb_discovery_jobs_created_at ON cmdb_discovery_jobs(created_at DESC);

-- ===================================================================
-- cmdb_assets — normalised inventory
-- ===================================================================

CREATE TABLE IF NOT EXISTS cmdb_assets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    name          VARCHAR(255) NOT NULL,
    adapter_id    UUID NOT NULL REFERENCES cmdb_adapters(id) ON DELETE CASCADE,
    asset_type    VARCHAR(100) NOT NULL,  -- "server" | "network_device" | "database" | "cloud_instance" | ...
    attributes    JSONB DEFAULT '{}',     -- raw adapter attributes
    status        VARCHAR(50) NOT NULL DEFAULT 'active',
    discovered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_cmdb_assets_tenant_adapter_type_name UNIQUE (adapter_id, asset_type, name, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_cmdb_assets_tenant_id ON cmdb_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_assets_adapter_id ON cmdb_assets(adapter_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_assets_asset_type ON cmdb_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_cmdb_assets_status ON cmdb_assets(status);
CREATE INDEX IF NOT EXISTS idx_cmdb_assets_discovered_at ON cmdb_assets(discovered_at DESC);
