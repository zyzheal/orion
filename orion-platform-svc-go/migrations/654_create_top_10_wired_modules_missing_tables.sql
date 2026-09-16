-- 654_create_top_10_wired_modules_missing_tables.sql
-- 10 个活跃模块各自缺 1 张表的批量修复:
--   user-activity -> user_activities
--   user-profile -> user_profiles
--   user-status -> user_statuses
--   user-token -> user_tokens
--   topology -> topology
-- 回滚见 654_create_top_10_wired_modules_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS user_activities (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL,
    action        TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT '',
    resource_id   TEXT NOT NULL DEFAULT '',
    details       JSONB DEFAULT '{}',
    ip_address    TEXT NOT NULL DEFAULT '',
    user_agent    TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_activities_user ON user_activities(user_id);

CREATE TABLE IF NOT EXISTS user_profiles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID NOT NULL,
    first_name  TEXT NOT NULL DEFAULT '',
    last_name   TEXT NOT NULL DEFAULT '',
    bio         TEXT NOT NULL DEFAULT '',
    timezone    TEXT NOT NULL DEFAULT '',
    avatar_url  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);

CREATE TABLE IF NOT EXISTS user_statuses (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    user_id    UUID NOT NULL,
    status     TEXT NOT NULL,
    message    TEXT NOT NULL DEFAULT '',
    set_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_statuses_tenant ON user_statuses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_statuses_user ON user_statuses(user_id);

CREATE TABLE IF NOT EXISTS user_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID NOT NULL,
    name        TEXT NOT NULL,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_tokens_tenant ON user_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_user ON user_tokens(user_id);

CREATE TABLE IF NOT EXISTS topology (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    value      TEXT NOT NULL DEFAULT '',
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_topology_tenant ON topology(tenant_id);
