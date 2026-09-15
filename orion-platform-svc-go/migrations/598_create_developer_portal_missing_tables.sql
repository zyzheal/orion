-- 598_create_developer_portal_missing_tables.sql
-- developer-portal 模块 7 张表无 CREATE TABLE。
-- 回滚见 598_create_developer_portal_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS developer_portals (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_developer_portals_tenant ON developer_portals(tenant_id);

CREATE TABLE IF NOT EXISTS portal_documents (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    category   TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'draft',
    views      INTEGER NOT NULL DEFAULT 0,
    helpful    INTEGER NOT NULL DEFAULT 0,
    version    TEXT NOT NULL DEFAULT '1',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_documents_tenant ON portal_documents(tenant_id);

CREATE TABLE IF NOT EXISTS portal_document_versions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    version     TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL DEFAULT '',
    created_by  TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_document_versions_doc ON portal_document_versions(document_id);

CREATE TABLE IF NOT EXISTS dev_portal_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    user_id         TEXT NOT NULL DEFAULT '',
    api_name        TEXT NOT NULL DEFAULT '',
    plan_name       TEXT NOT NULL DEFAULT '',
    quota_per_day   INTEGER NOT NULL DEFAULT 0,
    quota_per_month INTEGER NOT NULL DEFAULT 0,
    used_per_day    INTEGER NOT NULL DEFAULT 0,
    used_per_month  INTEGER NOT NULL DEFAULT 0,
    reason          TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'pending',
    approved_by     TEXT NOT NULL DEFAULT '',
    reject_reason   TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dev_portal_subscriptions_tenant ON dev_portal_subscriptions(tenant_id);

CREATE TABLE IF NOT EXISTS dev_portal_sdk_tasks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    language   TEXT NOT NULL DEFAULT 'go',
    status     TEXT NOT NULL DEFAULT 'pending',
    output_url TEXT NOT NULL DEFAULT '',
    error      TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dev_portal_sdk_tasks_tenant ON dev_portal_sdk_tasks(tenant_id);

CREATE TABLE IF NOT EXISTS dev_portal_playground_requests (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    user_id    TEXT NOT NULL DEFAULT '',
    name       TEXT NOT NULL DEFAULT '',
    method     TEXT NOT NULL DEFAULT 'GET',
    path       TEXT NOT NULL DEFAULT '',
    headers    JSONB DEFAULT '{}',
    body       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dev_portal_playground_requests_tenant ON dev_portal_playground_requests(tenant_id);

CREATE TABLE IF NOT EXISTS dev_portal_mock_rules (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    method     TEXT NOT NULL DEFAULT 'GET',
    path       TEXT NOT NULL DEFAULT '',
    responses  JSONB DEFAULT '[]',
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dev_portal_mock_rules_tenant ON dev_portal_mock_rules(tenant_id);
