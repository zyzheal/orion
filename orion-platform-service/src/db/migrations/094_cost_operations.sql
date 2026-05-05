-- 094: Cost Operations
-- 预算门禁、异常检测、优化建议

CREATE TABLE IF NOT EXISTS cost_budget_guards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  max_cost DECIMAL(10, 2) NOT NULL,
  warning_threshold FLOAT NOT NULL DEFAULT 0.8,
  action_on_exceed VARCHAR(30) NOT NULL DEFAULT 'block',  -- block, warn, notify
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cost_budget_guards_tenant ON cost_budget_guards(tenant_id);
CREATE INDEX idx_cost_budget_guards_pipeline ON cost_budget_guards(pipeline_id);
CREATE INDEX idx_cost_budget_guards_created ON cost_budget_guards(created_at DESC);

CREATE TABLE IF NOT EXISTS cost_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  cost_type VARCHAR(30) NOT NULL DEFAULT 'compute',
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cost_records_tenant ON cost_records(tenant_id);
CREATE INDEX idx_cost_records_run ON cost_records(pipeline_run_id);
CREATE INDEX idx_cost_records_type ON cost_records(cost_type);
CREATE INDEX idx_cost_records_created ON cost_records(created_at DESC);

CREATE TABLE IF NOT EXISTS cost_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  anomaly_type VARCHAR(30) NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  deviation_percent FLOAT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}',
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cost_anomalies_tenant ON cost_anomalies(tenant_id);
CREATE INDEX idx_cost_anomalies_type ON cost_anomalies(anomaly_type);
CREATE INDEX idx_cost_anomalies_resolved ON cost_anomalies(resolved);
CREATE INDEX idx_cost_anomalies_detected ON cost_anomalies(detected_at DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- cost_budget_guards
ALTER TABLE cost_budget_guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_budget_guards FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cost_budget_guards ON cost_budget_guards
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_cost_budget_guards_tenant_rls ON cost_budget_guards(tenant_id);

COMMENT ON POLICY tenant_isolation_cost_budget_guards ON cost_budget_guards IS
    'Tenant isolation RLS policy - cost budget guards visible only to owning tenant';

-- cost_records
ALTER TABLE cost_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_records FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cost_records ON cost_records
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_cost_records_tenant_rls ON cost_records(tenant_id);

COMMENT ON POLICY tenant_isolation_cost_records ON cost_records IS
    'Tenant isolation RLS policy - cost records visible only to owning tenant';

-- cost_anomalies
ALTER TABLE cost_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_anomalies FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cost_anomalies ON cost_anomalies
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_cost_anomalies_tenant_rls ON cost_anomalies(tenant_id);

COMMENT ON POLICY tenant_isolation_cost_anomalies ON cost_anomalies IS
    'Tenant isolation RLS policy - cost anomalies visible only to owning tenant';
