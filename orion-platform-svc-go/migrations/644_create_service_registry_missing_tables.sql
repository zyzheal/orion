-- 644_create_service_registry_missing_tables.sql
-- service-registry 模块: service_registry 表无 CREATE TABLE。
-- 回滚见 644_create_service_registry_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS service_registry (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    service_id     UUID NOT NULL,
    service_name   TEXT NOT NULL,
    service_url    TEXT NOT NULL,
    protocol       TEXT NOT NULL DEFAULT 'http',
    version        TEXT NOT NULL DEFAULT '1.0',
    status         TEXT NOT NULL DEFAULT 'active',
    health_status  TEXT NOT NULL DEFAULT 'healthy',
    metadata       JSONB DEFAULT '{}',
    registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_registry_tenant ON service_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_registry_service ON service_registry(service_id);
