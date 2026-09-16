-- 668_create_env_and_notification_missing_tables.sql
-- 3 个模块: ephemeral-env / notification-management / notification-policy。
-- notification-management 表名是连字符 notification-management（非下划线）。
-- 回滚见 668_create_env_and_notification_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS ephemeral_env (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    environment_name  TEXT NOT NULL,
    ttl_seconds       INTEGER NOT NULL DEFAULT 3600,
    status            TEXT NOT NULL DEFAULT 'creating',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ephemeral_env_tenant ON ephemeral_env(tenant_id);

CREATE TABLE IF NOT EXISTS ephemeral_env_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    env_id     UUID NOT NULL,
    level      TEXT NOT NULL DEFAULT 'info',
    message    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ephemeral_env_logs_env ON ephemeral_env_logs(env_id);

-- notification-management: 表名带连字符，用引号包裹。
CREATE TABLE IF NOT EXISTS "notification-management" (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    value      TEXT NOT NULL DEFAULT '',
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notification_management_tenant ON "notification-management"(tenant_id);

CREATE TABLE IF NOT EXISTS notification_policy_workflows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID,
    policy_id   UUID,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    steps       JSONB DEFAULT '[]',
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notification_policy_workflows_tenant ON notification_policy_workflows(tenant_id);
