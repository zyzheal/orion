-- Migration 258: Module Registry Persistence
-- Migrates ModuleRegistry's in-memory Map<string, ModuleDescriptor> to PostgreSQL

CREATE TABLE IF NOT EXISTS module_registry (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    level TEXT NOT NULL DEFAULT 'service',
    domain TEXT,
    state TEXT NOT NULL DEFAULT 'registered',
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_start BOOLEAN NOT NULL DEFAULT true,
    dependencies JSONB NOT NULL DEFAULT '[]',
    priority INTEGER NOT NULL DEFAULT 100,
    route_prefix TEXT,
    error TEXT,
    tenant_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module_registry_level ON module_registry(level);
CREATE INDEX IF NOT EXISTS idx_module_registry_state ON module_registry(state);
CREATE INDEX IF NOT EXISTS idx_module_registry_domain ON module_registry(domain);
CREATE INDEX IF NOT EXISTS idx_module_registry_enabled ON module_registry(enabled);
CREATE INDEX IF NOT EXISTS idx_module_registry_tenant_id ON module_registry(tenant_id);

COMMENT ON TABLE module_registry IS 'Module registration and lifecycle state (migrated from ModuleRegistry in-memory Map)';
