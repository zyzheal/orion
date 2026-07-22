-- Artifact module tables

CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    version VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'BUILD_OUTPUT',
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    size_bytes BIGINT DEFAULT 0,
    checksum_sha256 VARCHAR(255),
    checksum_sha512 VARCHAR(255),
    metadata JSONB,
    storage_path VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_id ON artifacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_namespace ON artifacts(namespace);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);
CREATE INDEX IF NOT EXISTS idx_artifacts_status ON artifacts(status);

CREATE TABLE IF NOT EXISTS artifact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    artifact_id VARCHAR(255) NOT NULL,
    tag VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifact_tags_tenant_id ON artifact_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifact_tags_artifact_id ON artifact_tags(artifact_id);

CREATE TABLE IF NOT EXISTS artifact_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    artifact_id VARCHAR(255) NOT NULL,
    downloaded_by VARCHAR(255) NOT NULL,
    downloaded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address VARCHAR(255),
    user_agent VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_artifact_downloads_tenant_id ON artifact_downloads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifact_downloads_artifact_id ON artifact_downloads(artifact_id);

CREATE TABLE IF NOT EXISTS artifact_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    artifact_id VARCHAR(255) NOT NULL,
    from_stage VARCHAR(50) NOT NULL,
    to_stage VARCHAR(50) NOT NULL,
    promoted_by VARCHAR(255) NOT NULL,
    approved_by VARCHAR(255),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifact_promotions_tenant_id ON artifact_promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifact_promotions_artifact_id ON artifact_promotions(artifact_id);
