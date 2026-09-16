-- 674_create_service_health_and_topology_missing_tables.sql
-- 2 个模块: service-health / service-topology。
-- service_health_results 是事件流，无 id 列。
-- service_topology 用 (tenant_id, service_name) 复合主键 (ON CONFLICT DO NOTHING)。
-- 回滚见 674_create_service_health_and_topology_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS service_health_checks (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL,
    service_name             TEXT NOT NULL,
    check_type               TEXT NOT NULL DEFAULT 'http',
    endpoint                 TEXT NOT NULL,
    interval_seconds         INTEGER NOT NULL DEFAULT 60,
    timeout_seconds          INTEGER NOT NULL DEFAULT 10,
    last_status              TEXT NOT NULL DEFAULT 'unknown',
    last_check_at            TIMESTAMPTZ,
    consecutive_failures     INTEGER NOT NULL DEFAULT 0,
    metadata                 JSONB DEFAULT '{}',
    enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_health_checks_tenant ON service_health_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_health_checks_service ON service_health_checks(service_name);

CREATE TABLE IF NOT EXISTS service_health_results (
    check_id          UUID NOT NULL,
    status            TEXT NOT NULL DEFAULT 'ok',
    response_time_ms  INTEGER NOT NULL DEFAULT 0,
    error             TEXT NOT NULL DEFAULT '',
    checked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_health_results_check ON service_health_results(check_id);

CREATE TABLE IF NOT EXISTS service_topology (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    service_name   TEXT NOT NULL,
    service_url    TEXT NOT NULL DEFAULT '',
    port           INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'active',
    dependencies   JSONB DEFAULT '[]',
    metadata       JSONB DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_topology_tenant ON service_topology(tenant_id);

CREATE TABLE IF NOT EXISTS topology_edges (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    source_service   TEXT NOT NULL,
    target_service   TEXT NOT NULL,
    relation_type    TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_topology_edges_tenant ON topology_edges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_topology_edges_source ON topology_edges(source_service);
