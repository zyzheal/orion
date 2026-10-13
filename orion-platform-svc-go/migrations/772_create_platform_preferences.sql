-- Migration 772: Platform Preferences — 用户偏好设置
CREATE TABLE IF NOT EXISTS platform_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    preference_key  TEXT NOT NULL,
    preference_value TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id, preference_key)
);
CREATE INDEX idx_platform_preferences_user ON platform_preferences(tenant_id, user_id);
