-- Migration 332: RDM Extensions (研发管理扩展)
-- RDM 制品与评审

CREATE TABLE IF NOT EXISTS rdm_artifacts (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    artifact_type   TEXT NOT NULL,
    version         TEXT NOT NULL,
    repository      TEXT,
    build_id        TEXT,
    commit_sha      TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'created',
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rdm_artifacts_tenant ON rdm_artifacts(tenant_id);
CREATE INDEX idx_rdm_artifacts_type ON rdm_artifacts(artifact_type, created_at DESC);

ALTER TABLE rdm_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdm_artifacts FORCE ROW LEVEL SECURITY;
CREATE POLICY rdm_artifacts_tenant_isolation ON rdm_artifacts
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS rdm_reviews (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    artifact_id     TEXT NOT NULL REFERENCES rdm_artifacts(id) ON DELETE CASCADE,
    reviewer_id     TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    score           INTEGER,
    comments        TEXT,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rdm_reviews_tenant ON rdm_reviews(tenant_id);
CREATE INDEX idx_rdm_reviews_artifact ON rdm_reviews(artifact_id);

ALTER TABLE rdm_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdm_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY rdm_reviews_tenant_isolation ON rdm_reviews
    USING (tenant_id = current_setting('app.current_tenant_id', true));
