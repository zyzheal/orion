-- Script Versions table (Task 10)
-- Script content version tracking with diff comparison

CREATE TABLE IF NOT EXISTS script_versions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    script_id VARCHAR(255) NOT NULL,
    version VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    parameters JSONB DEFAULT '{}',
    change_description TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),

    -- Unique constraint: one version string per script per tenant
    CONSTRAINT unique_version_per_script UNIQUE (tenant_id, script_id, version)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_script_versions_tenant ON script_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_script_versions_script ON script_versions(script_id);
CREATE INDEX IF NOT EXISTS idx_script_versions_created ON script_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_script_versions_hash ON script_versions(content_hash);

-- Composite index for version lookup
CREATE INDEX IF NOT EXISTS idx_script_versions_tenant_script_version
  ON script_versions(tenant_id, script_id, version);

-- Row Level Security
ALTER TABLE script_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_script_versions ON script_versions
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );
