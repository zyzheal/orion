-- Migration 052: K8s Cost Allocation
-- 对标 OpenCost 的 K8s 成本分配模型
-- 支持集群/Namespace/Pod 三级成本分摊 + 预算管理

-- 1. k8s_cluster_cost 表 - 集群级月度成本
CREATE TABLE IF NOT EXISTS k8s_cluster_cost (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  cluster_name    VARCHAR(128) NOT NULL,
  region          VARCHAR(64),
  month           DATE NOT NULL,
  node_count      INTEGER,
  total_cpu_cores NUMERIC(10,2),
  total_memory_gb NUMERIC(10,2),
  total_gpu_count INTEGER DEFAULT 0,
  compute_cost    NUMERIC(12,2),
  storage_cost    NUMERIC(12,2),
  network_cost    NUMERIC(12,2),
  total_cost      NUMERIC(12,2),
  currency        VARCHAR(3) DEFAULT 'CNY',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, cluster_name, month)
);

ALTER TABLE k8s_cluster_cost ENABLE ROW LEVEL SECURITY;
ALTER TABLE k8s_cluster_cost FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_k8s_cluster_cost ON k8s_cluster_cost
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_k8s_cluster_cost_month ON k8s_cluster_cost(tenant_id, month);
CREATE INDEX idx_k8s_cluster_cost_name ON k8s_cluster_cost(tenant_id, cluster_name);

-- 2. k8s_namespace_cost 表 - Namespace 级月度成本分配
CREATE TABLE IF NOT EXISTS k8s_namespace_cost (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  cluster_name    VARCHAR(128) NOT NULL,
  namespace       VARCHAR(128) NOT NULL,
  month           DATE NOT NULL,
  cpu_request_cores   NUMERIC(10,4),
  cpu_usage_cores     NUMERIC(10,4),
  memory_request_gb   NUMERIC(10,4),
  memory_usage_gb     NUMERIC(10,4),
  gpu_count           INTEGER DEFAULT 0,
  pod_count           INTEGER,
  compute_cost        NUMERIC(12,2),
  storage_cost        NUMERIC(12,2),
  total_cost          NUMERIC(12,2),
  cost_per_pod        NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, cluster_name, namespace, month)
);

ALTER TABLE k8s_namespace_cost ENABLE ROW LEVEL SECURITY;
ALTER TABLE k8s_namespace_cost FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_k8s_namespace_cost ON k8s_namespace_cost
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_k8s_namespace_cost_month ON k8s_namespace_cost(tenant_id, cluster_name, month);

-- 3. k8s_pod_cost 表 - Pod 级月度成本明细
CREATE TABLE IF NOT EXISTS k8s_pod_cost (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  cluster_name    VARCHAR(128) NOT NULL,
  namespace       VARCHAR(128) NOT NULL,
  pod_name        VARCHAR(255) NOT NULL,
  workload_name   VARCHAR(255),
  workload_type   VARCHAR(32),
  month           DATE NOT NULL,
  cpu_request_millicores  INTEGER,
  cpu_usage_millicores    INTEGER,
  memory_request_mb       INTEGER,
  memory_usage_mb         INTEGER,
  gpu_count               INTEGER DEFAULT 0,
  running_hours           NUMERIC(10,2),
  total_cost              NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE k8s_pod_cost ENABLE ROW LEVEL SECURITY;
ALTER TABLE k8s_pod_cost FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_k8s_pod_cost ON k8s_pod_cost
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_k8s_pod_cost_month ON k8s_pod_cost(tenant_id, cluster_name, namespace, month);

-- 4. finops_budget 表 - 成本预算配置
CREATE TABLE IF NOT EXISTS finops_budget (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  scope_type      VARCHAR(32) NOT NULL,
  scope_value     VARCHAR(255) NOT NULL,
  monthly_limit   NUMERIC(12,2) NOT NULL,
  alert_threshold NUMERIC(5,2) DEFAULT 0.8,
  currency        VARCHAR(3) DEFAULT 'CNY',
  enabled         BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE finops_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE finops_budget FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_finops_budget ON finops_budget
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_finops_budget_tenant ON finops_budget(tenant_id, scope_type, enabled) WHERE enabled = TRUE;
