-- 604_create_pandawiki_missing_tables.sql
-- pandawiki 模块 4 张表无 CREATE TABLE。
-- 回滚见 604_create_pandawiki_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS kb_spaces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    type        TEXT NOT NULL DEFAULT '',
    source      TEXT NOT NULL DEFAULT '',
    owner_id    TEXT NOT NULL DEFAULT '',
    team_id     TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_spaces_tenant ON kb_spaces(tenant_id);

CREATE TABLE IF NOT EXISTS kb_docs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    space_id   UUID,
    title      TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    type       TEXT NOT NULL DEFAULT '',
    source     TEXT NOT NULL DEFAULT '',
    tags       TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'published',
    version    TEXT NOT NULL DEFAULT '1',
    author_id  TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_docs_tenant ON kb_docs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_space ON kb_docs(space_id);

CREATE TABLE IF NOT EXISTS kb_doc_versions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id     UUID NOT NULL,
    version    TEXT NOT NULL DEFAULT '',
    title      TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    tags       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_doc_versions_doc ON kb_doc_versions(doc_id);

CREATE TABLE IF NOT EXISTS kb_sync_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    status        TEXT NOT NULL DEFAULT '',
    source        TEXT NOT NULL DEFAULT '',
    total_docs    INTEGER NOT NULL DEFAULT 0,
    success_docs  INTEGER NOT NULL DEFAULT 0,
    failed_docs   INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NOT NULL DEFAULT '',
    started_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_sync_logs_tenant ON kb_sync_logs(tenant_id);
