-- 629_create_infrastructure_missing_tables.sql
-- infrastructure 模块: connector_health_metrics / infrastructure_network_policies 2 张表无 CREATE TABLE。
-- connector_health_metrics 用 (connector_id, tenant_id) 复合主键 (ON CONFLICT upsert 模式)。
-- 回滚见 629_create_infrastructure_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS connector_health_metrics (
    connector_id  UUID NOT NULL,
    tenant_id     UUID NOT NULL,
    status        TEXT NOT NULL DEFAULT 'unknown',
    last_ping_at  TIMESTAMPTZ,
    latency_ms    INTEGER NOT NULL DEFAULT 0,
    error_count   INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (connector_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS infrastructure_network_policies (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sandbox_id     UUID NOT NULL,
    tenant_id      UUID NOT NULL,
    name           TEXT NOT NULL,
    namespace      TEXT NOT NULL DEFAULT '',
    labels         JSONB DEFAULT '{}',
    annotations    JSONB DEFAULT '{}',
    ingress_rules  JSONB DEFAULT '[]',
    egress_rules   JSONB DEFAULT '[]',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_infrastructure_network_policies_sandbox ON infrastructure_network_policies(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_infrastructure_network_policies_tenant ON infrastructure_network_policies(tenant_id);
