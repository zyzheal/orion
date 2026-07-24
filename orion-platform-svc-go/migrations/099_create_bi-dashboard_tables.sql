-- Bi-Dashboard module tables (auto-generated)

CREATE TABLE IF NOT EXISTS bi_dashboards (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_bi_dashboards_tenant ON bi_dashboards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bi_dashboards_created ON bi_dashboards(created_at DESC);

