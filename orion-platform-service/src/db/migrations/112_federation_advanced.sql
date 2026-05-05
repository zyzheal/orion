-- 112: Federation Advanced
-- 跨集群调度、策略引擎、资源池

-- cross_cluster_scheduling 表（跨集群调度策略）
CREATE TABLE IF NOT EXISTS cross_cluster_scheduling (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  schedule_name     VARCHAR(200) NOT NULL,
  description       TEXT,
  scheduling_type   VARCHAR(50) NOT NULL,                        -- load_balance, failover, geo_routing, cost_optimization
  source_clusters   JSONB NOT NULL DEFAULT '[]',
  target_clusters   JSONB NOT NULL DEFAULT '[]',
  rules             JSONB NOT NULL DEFAULT '[]',
  priority          VARCHAR(20) NOT NULL DEFAULT 'normal',       -- critical, high, normal, low
  status            VARCHAR(30) NOT NULL DEFAULT 'active',       -- active, paused, disabled
  last_executed_at  TIMESTAMPTZ,
  last_execution_result VARCHAR(30),
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cross_cluster_scheduling_tenant ON cross_cluster_scheduling(tenant_id);
CREATE INDEX idx_cross_cluster_scheduling_type ON cross_cluster_scheduling(scheduling_type);
CREATE INDEX idx_cross_cluster_scheduling_status ON cross_cluster_scheduling(status);
CREATE INDEX idx_cross_cluster_scheduling_priority ON cross_cluster_scheduling(priority);

-- policy_engines 表（策略引擎配置）
CREATE TABLE IF NOT EXISTS policy_engines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engine_name       VARCHAR(200) NOT NULL,
  engine_type       VARCHAR(50) NOT NULL DEFAULT 'opa',          -- opa, kyverno, custom, cel
  policy_language   VARCHAR(50) NOT NULL DEFAULT 'rego',         -- rego, yaml, json, cel
  policies          JSONB NOT NULL DEFAULT '[]',
  evaluation_mode   VARCHAR(30) NOT NULL DEFAULT 'enforce',      -- enforce, audit, dry_run
  scope             JSONB NOT NULL DEFAULT '{}',
  default_action    VARCHAR(30) NOT NULL DEFAULT 'deny',         -- allow, deny, warn
  status            VARCHAR(30) NOT NULL DEFAULT 'active',       -- active, inactive, testing
  violation_count   INT NOT NULL DEFAULT 0,
  last_evaluated_at TIMESTAMPTZ,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_policy_engines_tenant ON policy_engines(tenant_id);
CREATE INDEX idx_policy_engines_type ON policy_engines(engine_type);
CREATE INDEX idx_policy_engines_mode ON policy_engines(evaluation_mode);
CREATE INDEX idx_policy_engines_status ON policy_engines(status);

-- resource_pools 表（资源池管理）
CREATE TABLE IF NOT EXISTS resource_pools (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pool_name         VARCHAR(200) NOT NULL,
  pool_type         VARCHAR(50) NOT NULL,                        -- compute, storage, network, gpu, memory
  cluster_id        VARCHAR(200),
  total_capacity    JSONB NOT NULL DEFAULT '{}',
  allocated         JSONB NOT NULL DEFAULT '{}',
  available         JSONB NOT NULL DEFAULT '{}',
  allocation_policy VARCHAR(50) NOT NULL DEFAULT 'fifo',         -- fifo, priority, fair_share, weighted
  max_allocation_pct FLOAT NOT NULL DEFAULT 80,
  status            VARCHAR(30) NOT NULL DEFAULT 'active',       -- active, full, maintenance, decommissioned
  tags              JSONB NOT NULL DEFAULT '[]',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resource_pools_tenant ON resource_pools(tenant_id);
CREATE INDEX idx_resource_pools_type ON resource_pools(pool_type);
CREATE INDEX idx_resource_pools_status ON resource_pools(status);
CREATE INDEX idx_resource_pools_cluster ON resource_pools(cluster_id);

-- RLS
ALTER TABLE cross_cluster_scheduling ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_engines ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cross_cluster_scheduling ON cross_cluster_scheduling
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_policy_engines ON policy_engines
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_resource_pools ON resource_pools
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
