-- Migration 727: DevOps Artifact Store — 构建产物存储
CREATE TABLE IF NOT EXISTS devops_artifacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    version         TEXT NOT NULL,
    artifact_type   TEXT NOT NULL DEFAULT 'image',
    -- image, binary, archive, source
    checksum        TEXT NOT NULL DEFAULT '',
    size_bytes      BIGINT NOT NULL DEFAULT 0,
    storage_path    TEXT NOT NULL DEFAULT '',
    metadata        JSONB NOT NULL DEFAULT '{}',
    pipeline_run_id UUID,
    created_by      TEXT NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name, version)
);
CREATE INDEX idx_devops_artifacts_tenant ON devops_artifacts(tenant_id, name);
