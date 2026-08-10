-- Create release management tables for release-management module
CREATE TABLE IF NOT EXISTS releases (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    name VARCHAR(256) NOT NULL,
    version VARCHAR(64) NOT NULL,
    description TEXT,
    status VARCHAR(32) DEFAULT 'draft',
    artifact_id VARCHAR(256),
    pipeline_id VARCHAR(256),
    approved_by VARCHAR(128),
    deployed_by VARCHAR(128),
    rollback_id VARCHAR(36),
    release_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deployed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_releases_tenant ON releases(tenant_id);
CREATE INDEX idx_releases_status ON releases(tenant_id, status);
