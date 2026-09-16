-- 615_create_auth_enhanced_missing_tables.sql
-- auth-enhanced 模块: auth_keys / auth_token_blacklist 2 张表无 CREATE TABLE。
-- 回滚见 615_create_auth_enhanced_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS auth_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    key_id      TEXT NOT NULL,
    algorithm   TEXT NOT NULL DEFAULT 'RS256',
    public_key  TEXT NOT NULL DEFAULT '',
    secret      TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_keys_tenant ON auth_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auth_keys_key_id ON auth_keys(key_id);

CREATE TABLE IF NOT EXISTS auth_token_blacklist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    token_id    TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    reason      TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_token_blacklist_tenant ON auth_token_blacklist(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auth_token_blacklist_token ON auth_token_blacklist(token_id);
