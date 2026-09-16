-- 608_create_cmdb_collector_missing_tables.sql
-- cmdb-collector 模块: cmdb_targets / cmdb_devices / cmdb_collections 3 张主表无 CREATE TABLE
-- (cmdb_adapters / cmdb_assets / cmdb_discovery_jobs 由 internal/cmdb-collector/migrations/001 局部定义,
--  此处一并纳入全局 migrations 目录, 因 INSERT 与 SELECT 跨文件引用).
-- 回滚见 608_create_cmdb_collector_missing_tables_down.sql。

-- 1. cmdb_adapters (adapter catalog, referenced by cmdb_discovery_jobs / cmdb_assets)
CREATE TABLE IF NOT EXISTS cmdb_adapters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        VARCHAR(255) NOT NULL,
    category    VARCHAR(50) NOT NULL,
    vendor      VARCHAR(255) NOT NULL,
    description TEXT,
    config      JSONB DEFAULT '{}',
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmdb_adapters_tenant ON cmdb_adapters(tenant_id);

-- 2. cmdb_targets
CREATE TABLE IF NOT EXISTS cmdb_targets (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL DEFAULT '',
    host       TEXT NOT NULL DEFAULT '',
    port       INTEGER NOT NULL DEFAULT 0,
    "type"     TEXT NOT NULL DEFAULT '',
    protocol   TEXT NOT NULL DEFAULT '',
    tenant_id  UUID NOT NULL,
    config     JSONB DEFAULT '{}',
    metadata   JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmdb_targets_tenant ON cmdb_targets(tenant_id);

-- 3. cmdb_devices
CREATE TABLE IF NOT EXISTS cmdb_devices (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id     TEXT NOT NULL DEFAULT '',
    name          TEXT NOT NULL DEFAULT '',
    "type"        TEXT NOT NULL DEFAULT '',
    vendor        TEXT NOT NULL DEFAULT '',
    model         TEXT NOT NULL DEFAULT '',
    ip            TEXT NOT NULL DEFAULT '',
    serial_number TEXT NOT NULL DEFAULT '',
    tenant_id     UUID NOT NULL,
    target_id     UUID,
    adapter       TEXT NOT NULL DEFAULT '',
    last_seen_at  TIMESTAMPTZ,
    attributes    JSONB DEFAULT '{}',
    status        TEXT NOT NULL DEFAULT 'active',
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmdb_devices_tenant ON cmdb_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_devices_target ON cmdb_devices(target_id);

-- 4. cmdb_collections
CREATE TABLE IF NOT EXISTS cmdb_collections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id   TEXT NOT NULL DEFAULT '',
    collector       TEXT NOT NULL DEFAULT '',
    device_id       UUID,
    target_id       UUID,
    tenant_id       UUID NOT NULL,
    phase           TEXT NOT NULL DEFAULT 'discover',
    status          TEXT NOT NULL DEFAULT 'pending',
    attribute_count INTEGER NOT NULL DEFAULT 0,
    attributes      JSONB DEFAULT '{}',
    error           TEXT,
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmdb_collections_tenant ON cmdb_collections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_collections_device ON cmdb_collections(device_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_collections_target ON cmdb_collections(target_id);

-- 5. cmdb_discovery_jobs (referenced by cmdb_assets FK)
CREATE TABLE IF NOT EXISTS cmdb_discovery_jobs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    adapter_id   UUID NOT NULL REFERENCES cmdb_adapters(id) ON DELETE CASCADE,
    target       VARCHAR(255) NOT NULL,
    status       VARCHAR(50) NOT NULL DEFAULT 'pending',
    result_count INT NOT NULL DEFAULT 0,
    error        TEXT,
    started_at   TIMESTAMPTZ,
    finished_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmdb_discovery_jobs_tenant ON cmdb_discovery_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_discovery_jobs_adapter ON cmdb_discovery_jobs(adapter_id);

-- 6. cmdb_assets (final child table)
CREATE TABLE IF NOT EXISTS cmdb_assets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    name          VARCHAR(255) NOT NULL,
    adapter_id    UUID NOT NULL REFERENCES cmdb_adapters(id) ON DELETE CASCADE,
    asset_type    VARCHAR(100) NOT NULL,
    attributes    JSONB DEFAULT '{}',
    status        VARCHAR(50) NOT NULL DEFAULT 'active',
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmdb_assets_tenant ON cmdb_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_assets_adapter ON cmdb_assets(adapter_id);
