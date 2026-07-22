-- 096: Efficiency Operations
-- 开发者画像、效能看板、效率指标

CREATE TABLE IF NOT EXISTS developer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  developer_id VARCHAR(100) NOT NULL,
  name VARCHAR(200),
  primary_skills TEXT[] NOT NULL DEFAULT '{}',
  productivity_score FLOAT NOT NULL DEFAULT 0,
  review_quality_score FLOAT NOT NULL DEFAULT 0,
  collaboration_score FLOAT NOT NULL DEFAULT 0,
  metrics_summary JSONB NOT NULL DEFAULT '{}',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, developer_id)
);
CREATE INDEX idx_developer_profiles_tenant ON developer_profiles(tenant_id);
CREATE INDEX idx_developer_profiles_productivity ON developer_profiles(productivity_score DESC);

CREATE TABLE IF NOT EXISTS efficiency_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_type VARCHAR(30) NOT NULL,  -- lead_time, deployment_frequency, change_failure_rate, mttr
  metric_value FLOAT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  scope_type VARCHAR(30) NOT NULL DEFAULT 'tenant',  -- tenant, team, project
  scope_id VARCHAR(100),
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_efficiency_metrics_tenant ON efficiency_metrics(tenant_id);
CREATE INDEX idx_efficiency_metrics_type ON efficiency_metrics(metric_type);
CREATE INDEX idx_efficiency_metrics_period ON efficiency_metrics(period_start, period_end);
CREATE INDEX idx_efficiency_metrics_created ON efficiency_metrics(created_at DESC);

CREATE TABLE IF NOT EXISTS efficiency_dashboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  dora_metrics JSONB NOT NULL DEFAULT '{}',
  developer_activity JSONB NOT NULL DEFAULT '{}',
  code_quality_trend JSONB NOT NULL DEFAULT '{}',
  delivery_throughput JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, snapshot_date)
);
CREATE INDEX idx_efficiency_dashboard_snapshots_tenant ON efficiency_dashboard_snapshots(tenant_id);
CREATE INDEX idx_efficiency_dashboard_snapshots_date ON efficiency_dashboard_snapshots(snapshot_date DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- developer_profiles
ALTER TABLE developer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_developer_profiles ON developer_profiles
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_developer_profiles_tenant_rls ON developer_profiles(tenant_id);

COMMENT ON POLICY tenant_isolation_developer_profiles ON developer_profiles IS
    'Tenant isolation RLS policy - developer profiles visible only to owning tenant';

-- efficiency_metrics
ALTER TABLE efficiency_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE efficiency_metrics FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_efficiency_metrics ON efficiency_metrics
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_efficiency_metrics_tenant_rls ON efficiency_metrics(tenant_id);

COMMENT ON POLICY tenant_isolation_efficiency_metrics ON efficiency_metrics IS
    'Tenant isolation RLS policy - efficiency metrics visible only to owning tenant';

-- efficiency_dashboard_snapshots
ALTER TABLE efficiency_dashboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE efficiency_dashboard_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_efficiency_dashboard_snapshots ON efficiency_dashboard_snapshots
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_efficiency_dashboard_snapshots_tenant_rls ON efficiency_dashboard_snapshots(tenant_id);

COMMENT ON POLICY tenant_isolation_efficiency_dashboard_snapshots ON efficiency_dashboard_snapshots IS
    'Tenant isolation RLS policy - efficiency dashboard snapshots visible only to owning tenant';
