-- Migration 001: Artifact service tables
-- Migrated from orion-platform-service/src/services/artifact/

-- Artifacts core table
CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    namespace VARCHAR(128) NOT NULL DEFAULT 'default',
    name VARCHAR(256) NOT NULL,
    description TEXT,
    type VARCHAR(64) NOT NULL DEFAULT 'docker',
    version VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'available',
    size_bytes BIGINT DEFAULT 0,
    checksum_sha256 VARCHAR(64),
    checksum_sha512 VARCHAR(128),
    storage_path TEXT,
    repo_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_artifacts_tenant ON artifacts(tenant_id, created_at);
CREATE INDEX idx_artifacts_namespace ON artifacts(tenant_id, namespace);
CREATE INDEX idx_artifacts_name_version ON artifacts(tenant_id, namespace, name, version);
CREATE INDEX idx_artifacts_status ON artifacts(tenant_id, status);
CREATE INDEX idx_artifacts_type ON artifacts(tenant_id, type);

-- Artifact tags
CREATE TABLE IF NOT EXISTS artifact_tags (
    id UUID PRIMARY KEY,
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    tag VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(artifact_id, tag)
);
CREATE INDEX idx_artifact_tags_artifact ON artifact_tags(artifact_id);

-- Artifact download records
CREATE TABLE IF NOT EXISTS artifact_downloads (
    id UUID PRIMARY KEY,
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    downloaded_by VARCHAR(128) NOT NULL,
    ip_address VARCHAR(64),
    user_agent TEXT,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_artifact_downloads_artifact ON artifact_downloads(artifact_id);
CREATE INDEX idx_artifact_downloads_time ON artifact_downloads(downloaded_at);

-- Artifact promotion records (5-stage: development -> testing -> staging -> production -> released)
CREATE TABLE IF NOT EXISTS artifact_promotions (
    id UUID PRIMARY KEY,
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    from_stage VARCHAR(32) NOT NULL,
    to_stage VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    promoted_by VARCHAR(128) NOT NULL,
    approved_by VARCHAR(128),
    approved_at TIMESTAMPTZ,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_artifact_promotions_artifact ON artifact_promotions(artifact_id);
CREATE INDEX idx_artifact_promotions_time ON artifact_promotions(created_at);
