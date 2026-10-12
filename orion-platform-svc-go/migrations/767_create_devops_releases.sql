-- Migration 767: DevOps Releases — 版本发布管理
CREATE TABLE IF NOT EXISTS devops_releases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    version         TEXT NOT NULL,
    release_type    TEXT NOT NULL DEFAULT 'minor',
    -- major, minor, patch, prerelease
    status          TEXT NOT NULL DEFAULT 'draft',
    -- draft, released, deprecated, yanked
    changelog       TEXT,
    release_notes   TEXT,
    artifacts       JSONB NOT NULL DEFAULT '[]',
    released_by     TEXT,
    released_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name, version)
);
CREATE INDEX idx_devops_releases_tenant ON devops_releases(tenant_id, status);
