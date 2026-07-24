-- 099: Performance Engineering
-- 性能基线、性能画像、优化建议

-- performance_baselines 表（性能基线）
CREATE TABLE IF NOT EXISTS performance_baselines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name      VARCHAR(200) NOT NULL,
  endpoint          VARCHAR(500),
  metric_type       VARCHAR(50) NOT NULL,                  -- latency, throughput, error_rate, cpu, memory
  baseline_value    FLOAT NOT NULL,
  p50_value         FLOAT,
  p95_value         FLOAT,
  p99_value         FLOAT,
  measurement_period VARCHAR(20) NOT NULL DEFAULT '7d',    -- 1d, 7d, 30d
  environment       VARCHAR(50) NOT NULL DEFAULT 'production',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_performance_baselines_tenant ON performance_baselines(tenant_id);
CREATE INDEX idx_performance_baselines_service ON performance_baselines(service_name);
CREATE INDEX idx_performance_baselines_metric ON performance_baselines(metric_type);
CREATE INDEX idx_performance_baselines_env ON performance_baselines(environment);

-- performance_profiles 表（性能画像）
CREATE TABLE IF NOT EXISTS performance_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name      VARCHAR(200) NOT NULL,
  version           VARCHAR(50) NOT NULL,
  avg_latency_ms    FLOAT NOT NULL DEFAULT 0,
  p95_latency_ms    FLOAT NOT NULL DEFAULT 0,
  p99_latency_ms    FLOAT NOT NULL DEFAULT 0,
  requests_per_sec  FLOAT NOT NULL DEFAULT 0,
  error_rate_pct    FLOAT NOT NULL DEFAULT 0,
  cpu_usage_pct     FLOAT NOT NULL DEFAULT 0,
  memory_mb         FLOAT NOT NULL DEFAULT 0,
  gc_pause_ms       FLOAT DEFAULT 0,
  test_environment  VARCHAR(50) NOT NULL DEFAULT 'staging',
  measured_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata          JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_performance_profiles_tenant ON performance_profiles(tenant_id);
CREATE INDEX idx_performance_profiles_service ON performance_profiles(service_name);
CREATE INDEX idx_performance_profiles_version ON performance_profiles(version);
CREATE INDEX idx_performance_profiles_measured ON performance_profiles(measured_at DESC);

-- optimization_recommendations 表（优化建议）
CREATE TABLE IF NOT EXISTS optimization_recommendations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name      VARCHAR(200) NOT NULL,
  recommendation_type VARCHAR(50) NOT NULL,                -- code, config, infra, db, cache
  severity          VARCHAR(20) NOT NULL DEFAULT 'medium', -- critical, high, medium, low, info
  description       TEXT NOT NULL,
  current_value     JSONB NOT NULL DEFAULT '{}',
  suggested_value   JSONB NOT NULL DEFAULT '{}',
  estimated_impact  VARCHAR(100),
  status            VARCHAR(30) NOT NULL DEFAULT 'open',   -- open, accepted, applied, rejected, dismissed
  applied_by        VARCHAR(100),
  applied_at        TIMESTAMPTZ,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_optimization_recommendations_tenant ON optimization_recommendations(tenant_id);
CREATE INDEX idx_optimization_recommendations_service ON optimization_recommendations(service_name);
CREATE INDEX idx_optimization_recommendations_severity ON optimization_recommendations(severity);
CREATE INDEX idx_optimization_recommendations_status ON optimization_recommendations(status);

-- RLS
ALTER TABLE performance_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_performance_baselines ON performance_baselines
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_performance_profiles ON performance_profiles
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_optimization_recommendations ON optimization_recommendations
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
