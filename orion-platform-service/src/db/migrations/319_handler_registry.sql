-- Migration 319: Handler Registry SPI
-- 统一 SPI 注册表，管理所有扩展点处理器
-- Design doc: docs/reports/upgrade-detail-handler-registry-spi.md

CREATE TABLE IF NOT EXISTS handler_registry (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    domain          TEXT NOT NULL,
    name            TEXT NOT NULL,
    display_name    TEXT,
    description     TEXT,
    version         TEXT NOT NULL DEFAULT '1.0.0',
    status          TEXT NOT NULL DEFAULT 'active',
    config          JSONB NOT NULL DEFAULT '{}',
    metadata        JSONB NOT NULL DEFAULT '{}',
    health_check    JSONB NOT NULL DEFAULT '{}',
    last_health_status TEXT DEFAULT 'unknown',
    last_health_check  TIMESTAMPTZ,
    last_error      TEXT,
    error_count     INTEGER NOT NULL DEFAULT 0,
    registered_by   TEXT NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, domain, name)
);

CREATE INDEX idx_handler_registry_tenant ON handler_registry(tenant_id);
CREATE INDEX idx_handler_registry_domain ON handler_registry(domain);
CREATE INDEX idx_handler_registry_status ON handler_registry(status);
CREATE INDEX idx_handler_registry_domain_status ON handler_registry(domain, status);

ALTER TABLE handler_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE handler_registry FORCE ROW LEVEL SECURITY;

CREATE POLICY handler_registry_tenant_isolation ON handler_registry
    USING (tenant_id = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE handler_registry IS 'Handler SPI 注册表 - 统一管理所有扩展点处理器';
COMMENT ON COLUMN handler_registry.domain IS '处理器域名: alert-breaker, process-step, notification-channel, hook-executor, gate-evaluator';
COMMENT ON COLUMN handler_registry.status IS '处理器状态: active=活跃, disabled=禁用, error=异常';
