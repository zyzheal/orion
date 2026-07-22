-- Artifact-Lifecycle module tables (auto-generated)

CREATE TABLE IF NOT EXISTS artifact_lifecycles (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    artifact_id VARCHAR(255) NOT NULL,
    stage VARCHAR(255) NOT NULL,
    stage_status VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_artifact_lifecycles_tenant ON artifact_lifecycles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifact_lifecycles_created ON artifact_lifecycles(created_at DESC);

