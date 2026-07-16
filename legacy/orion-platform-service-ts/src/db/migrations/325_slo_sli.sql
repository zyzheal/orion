-- Migration 325: SLO/SLI Tracking
-- SLO 定义与 SLI 测量数据

CREATE TABLE IF NOT EXISTS slo_definitions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    slo_type        TEXT NOT NULL DEFAULT 'availability',
    target_value    NUMERIC(10,4) NOT NULL,
    target_unit     TEXT NOT NULL DEFAULT 'percent',
    promql_query    TEXT,
    window_days     INTEGER NOT NULL DEFAULT 30,
    alert_threshold NUMERIC(10,4),
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_slo_definitions_tenant ON slo_definitions(tenant_id);

ALTER TABLE slo_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE slo_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY slo_definitions_tenant_isolation ON slo_definitions
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS sli_measurements (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    slo_id          TEXT NOT NULL REFERENCES slo_definitions(id) ON DELETE CASCADE,
    measured_value  NUMERIC(10,4) NOT NULL,
    target_value    NUMERIC(10,4) NOT NULL,
    compliance      BOOLEAN NOT NULL,
    window_start    TIMESTAMPTZ NOT NULL,
    window_end      TIMESTAMPTZ NOT NULL,
    error_budget_remaining NUMERIC(10,4),
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sli_measurements_tenant ON sli_measurements(tenant_id);
CREATE INDEX idx_sli_measurements_slo ON sli_measurements(slo_id, window_start DESC);

ALTER TABLE sli_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sli_measurements FORCE ROW LEVEL SECURITY;
CREATE POLICY sli_measurements_tenant_isolation ON sli_measurements
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Error Budget
CREATE TABLE IF NOT EXISTS error_budgets (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    slo_id          TEXT NOT NULL REFERENCES slo_definitions(id) ON DELETE CASCADE,
    total_budget    NUMERIC(10,4) NOT NULL,
    consumed        NUMERIC(10,4) NOT NULL DEFAULT 0,
    remaining       NUMERIC(10,4) NOT NULL,
    window_start    TIMESTAMPTZ NOT NULL,
    window_end      TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL DEFAULT 'ok',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_error_budgets_tenant ON error_budgets(tenant_id);
CREATE INDEX idx_error_budgets_slo ON error_budgets(slo_id);

ALTER TABLE error_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_budgets FORCE ROW LEVEL SECURITY;
CREATE POLICY error_budgets_tenant_isolation ON error_budgets
    USING (tenant_id = current_setting('app.current_tenant_id', true));
