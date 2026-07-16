-- 366: K8s Cost Allocator Tables
-- 用于 K8sCostAllocator PostgreSQL 持久化

CREATE TABLE IF NOT EXISTS finops_k8s_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cluster_name VARCHAR(100),
  namespace VARCHAR(100) NOT NULL,
  deployment VARCHAR(200),
  pod_name VARCHAR(200),
  node_name VARCHAR(200),
  resource_type VARCHAR(50) NOT NULL DEFAULT 'pod',
  cpu_cores DECIMAL(10, 4),
  memory_gb DECIMAL(10, 2),
  storage_gb DECIMAL(10, 2),
  network_cost DECIMAL(12, 2) DEFAULT 0,
  cpu_cost DECIMAL(12, 2) DEFAULT 0,
  memory_cost DECIMAL(12, 2) DEFAULT 0,
  storage_cost DECIMAL(12, 2) DEFAULT 0,
  total_cost DECIMAL(12, 2) DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finops_k8s_costs_tenant ON finops_k8s_costs(tenant_id);
CREATE INDEX idx_finops_k8s_costs_namespace ON finops_k8s_costs(namespace);
CREATE INDEX idx_finops_k8s_costs_cluster ON finops_k8s_costs(cluster_name);
CREATE INDEX idx_finops_k8s_costs_timestamp ON finops_k8s_costs(timestamp DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

ALTER TABLE finops_k8s_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE finops_k8s_costs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_finops_k8s_costs ON finops_k8s_costs
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

COMMENT ON POLICY tenant_isolation_finops_k8s_costs ON finops_k8s_costs IS
    'Tenant isolation RLS policy - K8s cost records visible only to owning tenant';
