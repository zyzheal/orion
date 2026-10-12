-- Migration 768: DevOps Monitoring Config — 监控配置
CREATE TABLE IF NOT EXISTS devops_monitoring_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    target_type     TEXT NOT NULL DEFAULT 'service',
    -- service, host, container, custom
    target_id       TEXT NOT NULL,
    checks          JSONB NOT NULL DEFAULT '[]',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_devops_monitoring_tenant ON devops_monitoring_configs(tenant_id, enabled);
