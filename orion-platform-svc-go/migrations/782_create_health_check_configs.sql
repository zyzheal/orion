-- Migration 782: Health Check Configs — 健康检查配置
CREATE TABLE IF NOT EXISTS health_check_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    target_url      TEXT NOT NULL,
    check_type      TEXT NOT NULL DEFAULT 'http',
    -- http, tcp, udp, icmp, custom
    interval_sec    INTEGER NOT NULL DEFAULT 60,
    timeout_sec     INTEGER NOT NULL DEFAULT 10,
    success_pattern TEXT,
    failure_threshold INTEGER NOT NULL DEFAULT 3,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    last_check_at   TIMESTAMPTZ,
    last_status     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_health_check_configs_tenant ON health_check_configs(tenant_id, enabled);
