-- 098: Disaster Recovery
-- 灾备恢复计划、故障切换测试、备份配置

-- disaster_recovery_plans 表（灾备恢复计划）
CREATE TABLE IF NOT EXISTS disaster_recovery_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_name         VARCHAR(200) NOT NULL,
  rto_target        INT NOT NULL DEFAULT 3600,          -- Recovery Time Objective in seconds
  rpo_target        INT NOT NULL DEFAULT 300,            -- Recovery Point Objective in seconds
  priority          VARCHAR(20) NOT NULL DEFAULT 'medium', -- critical, high, medium, low
  status            VARCHAR(30) NOT NULL DEFAULT 'draft',  -- draft, active, testing, retired
  services          JSONB NOT NULL DEFAULT '[]',
  failover_strategy VARCHAR(50) NOT NULL DEFAULT 'active-passive',
  backup_regions    JSONB NOT NULL DEFAULT '[]',
  last_tested_at    TIMESTAMPTZ,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_disaster_recovery_plans_tenant ON disaster_recovery_plans(tenant_id);
CREATE INDEX idx_disaster_recovery_plans_status ON disaster_recovery_plans(status);
CREATE INDEX idx_disaster_recovery_plans_priority ON disaster_recovery_plans(priority);

-- dr_failover_tests 表（故障切换测试记录）
CREATE TABLE IF NOT EXISTS dr_failover_tests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES disaster_recovery_plans(id) ON DELETE CASCADE,
  test_name         VARCHAR(200) NOT NULL,
  test_type         VARCHAR(50) NOT NULL DEFAULT 'planned', -- planned, unplanned, partial
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  actual_rto        INT,
  actual_rpo        INT,
  result            VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, passed, failed, partial
  affected_services JSONB NOT NULL DEFAULT '[]',
  findings          TEXT,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dr_failover_tests_tenant ON dr_failover_tests(tenant_id);
CREATE INDEX idx_dr_failover_tests_plan ON dr_failover_tests(plan_id);
CREATE INDEX idx_dr_failover_tests_result ON dr_failover_tests(result);
CREATE INDEX idx_dr_failover_tests_started ON dr_failover_tests(started_at DESC);

-- backup_configs 表（备份配置）
CREATE TABLE IF NOT EXISTS backup_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type       VARCHAR(50) NOT NULL,                 -- database, volume, config, full
  source_id         VARCHAR(200) NOT NULL,
  backup_schedule   VARCHAR(50) NOT NULL DEFAULT '0 2 * * *',
  retention_days    INT NOT NULL DEFAULT 30,
  storage_location  VARCHAR(500) NOT NULL,
  encryption        BOOLEAN NOT NULL DEFAULT true,
  compression       VARCHAR(20) NOT NULL DEFAULT 'gzip',
  last_backup_at    TIMESTAMPTZ,
  last_backup_size  BIGINT DEFAULT 0,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_backup_configs_tenant ON backup_configs(tenant_id);
CREATE INDEX idx_backup_configs_source ON backup_configs(source_type, source_id);
CREATE INDEX idx_backup_configs_enabled ON backup_configs(enabled) WHERE enabled = true;

-- RLS
ALTER TABLE disaster_recovery_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dr_failover_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_disaster_recovery_plans ON disaster_recovery_plans
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_dr_failover_tests ON dr_failover_tests
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_backup_configs ON backup_configs
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
