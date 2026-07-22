-- Migration 070: SLO/SLI Tracking
-- Phase 3 Observability: SLO definitions, SLI measurements, error budget

-- SLO Definition table
CREATE TABLE IF NOT EXISTS slo_definition (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  slo_type        VARCHAR(32) NOT NULL,    -- availability/latency/throughput
  target_value    DECIMAL(10,4) NOT NULL,  -- 99.9 表示 99.9%
  target_unit     VARCHAR(16) NOT NULL,    -- percentage/ms/rps
  promql_query    TEXT NOT NULL,            -- PromQL 查询表达式
  window_days     INTEGER NOT NULL DEFAULT 30,
  alert_threshold DECIMAL(5,2) DEFAULT 80, -- 预算消耗百分比告警阈值
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_by      VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slo_tenant ON slo_definition(tenant_id);
CREATE INDEX IF NOT EXISTS idx_slo_type ON slo_definition(tenant_id, slo_type);

-- RLS for slo_definition
ALTER TABLE slo_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE slo_definition FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON slo_definition USING (tenant_id = current_setting('app.current_tenant_id', true));

-- SLI Measurement table (time-series)
CREATE TABLE IF NOT EXISTS sli_measurement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  slo_id          UUID NOT NULL REFERENCES slo_definition(id) ON DELETE CASCADE,
  sli_value       DECIMAL(10,6) NOT NULL,  -- 0.9995 表示 99.95%
  measured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sli_slo ON sli_measurement(slo_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_sli_tenant ON sli_measurement(tenant_id, measured_at DESC);

-- RLS for sli_measurement
ALTER TABLE sli_measurement ENABLE ROW LEVEL SECURITY;
ALTER TABLE sli_measurement FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sli_measurement USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Error Budget table
CREATE TABLE IF NOT EXISTS error_budget (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  slo_id          UUID NOT NULL REFERENCES slo_definition(id) ON DELETE CASCADE,
  total_budget    DECIMAL(10,4) NOT NULL,  -- 总误差预算（分钟）
  consumed        DECIMAL(10,4) NOT NULL,  -- 已消耗
  remaining       DECIMAL(10,4) NOT NULL,  -- 剩余
  burn_rate       DECIMAL(10,4),           -- 消耗速率
  is_exhausted    BOOLEAN NOT NULL DEFAULT false,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_slo ON error_budget(slo_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_tenant ON error_budget(tenant_id, calculated_at DESC);

-- RLS for error_budget
ALTER TABLE error_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_budget FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON error_budget USING (tenant_id = current_setting('app.current_tenant_id', true));
