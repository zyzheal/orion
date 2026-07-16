-- 087: Deploy Release Enhancement
-- 新增部署窗口、紧急部署、服务依赖和渐进式部署阶段表

-- deploy_windows 表（维护部署窗口）
CREATE TABLE IF NOT EXISTS deploy_windows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  environment_id  UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  cron_expression VARCHAR(50) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  timezone        VARCHAR(50) NOT NULL DEFAULT 'Asia/Shanghai',
  status          VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, inactive, deleted
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deploy_windows_tenant ON deploy_windows(tenant_id);
CREATE INDEX idx_deploy_windows_env ON deploy_windows(environment_id);
CREATE INDEX idx_deploy_windows_status ON deploy_windows(status);

-- deploy_emergencies 表（紧急部署记录）
CREATE TABLE IF NOT EXISTS deploy_emergencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deployment_id   UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  requested_by    VARCHAR(100) NOT NULL,
  approved_by     VARCHAR(100),
  approved_at     TIMESTAMPTZ,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, approved, rejected, completed, failed
  post_mortem     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deploy_emergencies_tenant ON deploy_emergencies(tenant_id);
CREATE INDEX idx_deploy_emergencies_deployment ON deploy_emergencies(deployment_id);
CREATE INDEX idx_deploy_emergencies_status ON deploy_emergencies(status);

-- deploy_service_dependencies 表（服务依赖关系）
CREATE TABLE IF NOT EXISTS deploy_service_dependencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name    VARCHAR(200) NOT NULL,
  depends_on      VARCHAR(200) NOT NULL,
  dependency_type VARCHAR(30) NOT NULL DEFAULT 'hard',  -- hard, soft, optional
  environment     VARCHAR(50) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deploy_svc_deps_tenant ON deploy_service_dependencies(tenant_id);
CREATE INDEX idx_deploy_svc_deps_service ON deploy_service_dependencies(service_name);
CREATE INDEX idx_deploy_svc_deps_env ON deploy_service_dependencies(environment);

-- deploy_progressive_stages 表（渐进式部署阶段）
CREATE TABLE IF NOT EXISTS deploy_progressive_stages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deployment_id   UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  stage_name      VARCHAR(100) NOT NULL,
  stage_order     INT NOT NULL,
  traffic_percent  INT NOT NULL DEFAULT 0,
  instance_count   INT NOT NULL DEFAULT 1,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, skipped
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  validation_result JSONB NOT NULL DEFAULT '{}',
  auto_promote    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deploy_prog_stages_tenant ON deploy_progressive_stages(tenant_id);
CREATE INDEX idx_deploy_prog_stages_deployment ON deploy_progressive_stages(deployment_id);
CREATE INDEX idx_deploy_prog_stages_status ON deploy_progressive_stages(status);
CREATE INDEX idx_deploy_prog_stages_order ON deploy_progressive_stages(deployment_id, stage_order);

-- 修改 deployments 表：添加渐进式部署相关字段
ALTER TABLE deployments
  ADD COLUMN IF NOT EXISTS deploy_strategy VARCHAR(30) NOT NULL DEFAULT 'standard',  -- standard, canary, blue-green, rolling
  ADD COLUMN IF NOT EXISTS rollback_strategy VARCHAR(30) NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS progressive_deploy_id UUID REFERENCES deploy_progressive_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS health_check_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS success_criteria JSONB NOT NULL DEFAULT '{}';

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- deploy_windows
ALTER TABLE deploy_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE deploy_windows FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_deploy_windows ON deploy_windows
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_deploy_windows_tenant_rls ON deploy_windows(tenant_id);

COMMENT ON POLICY tenant_isolation_deploy_windows ON deploy_windows IS
    'Tenant isolation RLS policy - deploy windows visible only to owning tenant';

-- deploy_emergencies
ALTER TABLE deploy_emergencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE deploy_emergencies FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_deploy_emergencies ON deploy_emergencies
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_deploy_emergencies_tenant_rls ON deploy_emergencies(tenant_id);

COMMENT ON POLICY tenant_isolation_deploy_emergencies ON deploy_emergencies IS
    'Tenant isolation RLS policy - deploy emergencies visible only to owning tenant';

-- deploy_service_dependencies
ALTER TABLE deploy_service_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE deploy_service_dependencies FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_deploy_service_dependencies ON deploy_service_dependencies
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_deploy_svc_deps_tenant_rls ON deploy_service_dependencies(tenant_id);

COMMENT ON POLICY tenant_isolation_deploy_service_dependencies ON deploy_service_dependencies IS
    'Tenant isolation RLS policy - service dependencies visible only to owning tenant';

-- deploy_progressive_stages
ALTER TABLE deploy_progressive_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deploy_progressive_stages FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_deploy_progressive_stages ON deploy_progressive_stages
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_deploy_prog_stages_tenant_rls ON deploy_progressive_stages(tenant_id);

COMMENT ON POLICY tenant_isolation_deploy_progressive_stages ON deploy_progressive_stages IS
    'Tenant isolation RLS policy - progressive stages visible only to owning tenant';
