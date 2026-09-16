-- 650_create_sso_missing_tables.sql
-- sso 模块: sso_config / sso_session 2 张表无 CREATE TABLE。
-- 回滚见 650_create_sso_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS sso_config (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    name         TEXT NOT NULL,
    provider_type TEXT NOT NULL DEFAULT '',
    config       JSONB DEFAULT '{}',
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sso_config_tenant ON sso_config(tenant_id);

CREATE TABLE IF NOT EXISTS sso_session (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    provider_id  UUID,
    state        TEXT NOT NULL DEFAULT '',
    redirect_url TEXT NOT NULL DEFAULT '',
    user_id      UUID,
    status       TEXT NOT NULL DEFAULT 'pending',
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sso_session_tenant ON sso_session(tenant_id);
