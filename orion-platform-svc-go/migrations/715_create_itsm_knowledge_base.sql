-- Migration 715: ITSM Knowledge Base — 知识库文章
CREATE TABLE IF NOT EXISTS itsm_knowledge_articles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    title           TEXT NOT NULL,
    slug            TEXT NOT NULL,
    content         TEXT,
    summary         TEXT,
    category        TEXT NOT NULL DEFAULT 'general',
    tags            TEXT[] DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'draft',
    -- draft, published, archived
    author_id       TEXT NOT NULL DEFAULT 'system',
    view_count      INTEGER NOT NULL DEFAULT 0,
    helpful_count   INTEGER NOT NULL DEFAULT 0,
    helpful_pct     FLOAT DEFAULT 0,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, slug)
);
CREATE INDEX idx_itsm_knowledge_tenant ON itsm_knowledge_articles(tenant_id, status);
CREATE INDEX idx_itsm_knowledge_category ON itsm_knowledge_articles(tenant_id, category);
