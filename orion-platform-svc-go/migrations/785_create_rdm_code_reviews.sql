-- Migration 785: RDM Code Reviews — 代码评审持久化
-- R-P0-05: RDM code-review handler stub → real

CREATE TABLE IF NOT EXISTS rdm_code_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    project_id      TEXT,
    title           TEXT NOT NULL,
    source_branch   TEXT,
    target_branch   TEXT,
    source_commit   TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    -- pending | approved | changes_requested | merged | closed
    author          TEXT,
    reviewers       JSONB NOT NULL DEFAULT '[]',
    comments_count  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rdm_code_reviews_tenant ON rdm_code_reviews(tenant_id, status);
CREATE INDEX idx_rdm_code_reviews_project ON rdm_code_reviews(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS rdm_code_review_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    review_id       UUID NOT NULL REFERENCES rdm_code_reviews(id) ON DELETE CASCADE,
    author          TEXT,
    content         TEXT NOT NULL,
    file            TEXT,
    line            INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rdm_code_review_comments_review ON rdm_code_review_comments(tenant_id, review_id);
