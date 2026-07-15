-- Maintenance-Window module tables (auto-generated)

CREATE TABLE IF NOT EXISTS maintenance_windows (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_tenant ON maintenance_windows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_created ON maintenance_windows(created_at DESC);

