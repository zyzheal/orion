-- Artifact-Version module tables
--
-- NOTE: Previously this file created a generic `records` table that was shared
-- with 12+ other auto-generated modules (ai-security, capacity, metadata, mlops,
-- ...), all with the same schema and no module discriminator. That made every
-- module unable to isolate its own records. This fix replaces `records` with
-- a module-scoped table `artifact_version_records` so artifact-version can
-- actually persist its own data.

CREATE TABLE IF NOT EXISTS artifact_version_records (
    id          VARCHAR(36) PRIMARY KEY,
    tenant_id   VARCHAR(36) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(255) NOT NULL DEFAULT 'active',
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at  TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_artifact_version_records_tenant
    ON artifact_version_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifact_version_records_created
    ON artifact_version_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_version_records_status
    ON artifact_version_records(tenant_id, status);

-- Artifact-version tags (immutable labels attached to a record)
CREATE TABLE IF NOT EXISTS artifact_version_tags (
    id          VARCHAR(36) PRIMARY KEY,
    tenant_id   VARCHAR(36) NOT NULL,
    record_id   VARCHAR(36) NOT NULL,
    tag         VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, record_id, tag),
);

CREATE INDEX IF NOT EXISTS idx_artifact_version_tags_record
    ON artifact_version_tags(tenant_id, record_id);
