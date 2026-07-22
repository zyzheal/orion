-- Change-Intelligence module tables (auto-generated)

CREATE TABLE IF NOT EXISTS change_analysises (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    change_id VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    risk_score DOUBLE PRECISION NOT NULL,
    blast_radius VARCHAR(255) NOT NULL,
    affected_services VARCHAR(255) NOT NULL,
    recommendations VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_change_analysises_tenant ON change_analysises(tenant_id);
CREATE INDEX IF NOT EXISTS idx_change_analysises_created ON change_analysises(created_at DESC);

