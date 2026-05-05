-- 113: Multi-Cloud Advanced
-- 跨可用区灾备、多云成本、云网络

-- cross_zone_dr 表（跨可用区灾备配置）
CREATE TABLE IF NOT EXISTS cross_zone_dr (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dr_name           VARCHAR(200) NOT NULL,
  primary_zone      VARCHAR(100) NOT NULL,
  standby_zones     JSONB NOT NULL DEFAULT '[]',
  replication_mode  VARCHAR(30) NOT NULL DEFAULT 'async',       -- sync, async, semi_sync
  rto_target        INT NOT NULL DEFAULT 3600,
  rpo_target        INT NOT NULL DEFAULT 300,
  failover_mode     VARCHAR(30) NOT NULL DEFAULT 'manual',      -- manual, semi_auto, full_auto
  last_failover_test TIMESTAMPTZ,
  health_status     VARCHAR(30) NOT NULL DEFAULT 'healthy',     -- healthy, degraded, unhealthy
  status            VARCHAR(30) NOT NULL DEFAULT 'active',      -- active, testing, disabled
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cross_zone_dr_tenant ON cross_zone_dr(tenant_id);
CREATE INDEX idx_cross_zone_dr_primary ON cross_zone_dr(primary_zone);
CREATE INDEX idx_cross_zone_dr_health ON cross_zone_dr(health_status);
CREATE INDEX idx_cross_zone_dr_status ON cross_zone_dr(status);

-- multi_cloud_cost 表（多云成本分析）
CREATE TABLE IF NOT EXISTS multi_cloud_cost (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cloud_provider    VARCHAR(100) NOT NULL,
  account_id        VARCHAR(100),
  billing_period    VARCHAR(20) NOT NULL,                       -- YYYY-MM format
  total_cost        FLOAT NOT NULL DEFAULT 0,
  compute_cost      FLOAT DEFAULT 0,
  storage_cost      FLOAT DEFAULT 0,
  network_cost      FLOAT DEFAULT 0,
  other_cost        FLOAT DEFAULT 0,
  budget            FLOAT,
  forecast_cost     FLOAT,
  savings_opportunities JSONB NOT NULL DEFAULT '[]',
  cost_breakdown    JSONB NOT NULL DEFAULT '{}',
  currency          VARCHAR(10) NOT NULL DEFAULT 'USD',
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_multi_cloud_cost_tenant ON multi_cloud_cost(tenant_id);
CREATE INDEX idx_multi_cloud_cost_provider ON multi_cloud_cost(cloud_provider);
CREATE INDEX idx_multi_cloud_cost_period ON multi_cloud_cost(billing_period);
CREATE INDEX idx_multi_cloud_cost_total ON multi_cloud_cost(total_cost DESC);

-- cloud_networking 表（云网络配置）
CREATE TABLE IF NOT EXISTS cloud_networking (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cloud_provider    VARCHAR(100) NOT NULL,
  network_type      VARCHAR(50) NOT NULL,                        -- vpc, vnet, subnet, peering, load_balancer, nat
  resource_id       VARCHAR(200) NOT NULL,
  resource_name     VARCHAR(200) NOT NULL,
  region            VARCHAR(100) NOT NULL,
  cidr_block        VARCHAR(50),
  status            VARCHAR(30) NOT NULL DEFAULT 'active',       -- active, inactive, error, deleting
  configuration     JSONB NOT NULL DEFAULT '{}',
  connected_networks JSONB NOT NULL DEFAULT '[]',
  bandwidth_mbps    INT,
  tags              JSONB NOT NULL DEFAULT '{}',
  discovered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cloud_networking_tenant ON cloud_networking(tenant_id);
CREATE INDEX idx_cloud_networking_provider ON cloud_networking(cloud_provider);
CREATE INDEX idx_cloud_networking_type ON cloud_networking(network_type);
CREATE INDEX idx_cloud_networking_status ON cloud_networking(status);
CREATE INDEX idx_cloud_networking_region ON cloud_networking(region);

-- RLS
ALTER TABLE cross_zone_dr ENABLE ROW LEVEL SECURITY;
ALTER TABLE multi_cloud_cost ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_networking ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cross_zone_dr ON cross_zone_dr
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_multi_cloud_cost ON multi_cloud_cost
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_cloud_networking ON cloud_networking
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
