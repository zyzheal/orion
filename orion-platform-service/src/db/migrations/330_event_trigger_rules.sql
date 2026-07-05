-- Migration 330: Event Trigger Rules (事件驱动触发)
-- 事件触发规则引擎

CREATE TABLE IF NOT EXISTS event_trigger_rules (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    event_type      TEXT NOT NULL,
    conditions      JSONB NOT NULL DEFAULT '{}',
    actions         JSONB NOT NULL DEFAULT '[]',
    throttle_config JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    priority        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_event_trigger_rules_tenant ON event_trigger_rules(tenant_id);
CREATE INDEX idx_event_trigger_rules_event ON event_trigger_rules(event_type);

ALTER TABLE event_trigger_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_trigger_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY event_trigger_rules_tenant_isolation ON event_trigger_rules
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- DAG 并行执行边
CREATE TABLE IF NOT EXISTS pipeline_dag_edges (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    pipeline_id     TEXT NOT NULL,
    from_step       TEXT NOT NULL,
    to_step         TEXT NOT NULL,
    condition       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_dag_edges_tenant ON pipeline_dag_edges(tenant_id);
CREATE INDEX idx_pipeline_dag_edges_pipeline ON pipeline_dag_edges(pipeline_id);

ALTER TABLE pipeline_dag_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_dag_edges FORCE ROW LEVEL SECURITY;
CREATE POLICY pipeline_dag_edges_tenant_isolation ON pipeline_dag_edges
    USING (tenant_id = current_setting('app.current_tenant_id', true));
