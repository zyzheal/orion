-- 089: Environment Management
-- 新增环境模板、环境休眠日志、环境 TTL 配置表，并修改 environments 表

-- environment_templates 表（环境模板）
CREATE TABLE IF NOT EXISTS environment_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  template_type   VARCHAR(30) NOT NULL DEFAULT 'standard',  -- standard, development, staging, production, testing
  resources       JSONB NOT NULL DEFAULT '{}',  -- CPU, memory, storage 等资源定义
  variables       JSONB NOT NULL DEFAULT '{}',  -- 环境变量模板
  network_config  JSONB NOT NULL DEFAULT '{}',
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_env_templates_tenant ON environment_templates(tenant_id);
CREATE INDEX idx_env_templates_type ON environment_templates(template_type);
CREATE INDEX idx_env_templates_default ON environment_templates(is_default) WHERE is_default = true;

-- environment_hibernation_log 表（环境休眠日志）
CREATE TABLE IF NOT EXISTS environment_hibernation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  environment_id  UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  action          VARCHAR(20) NOT NULL,  -- hibernate, wake, auto-hibernate
  triggered_by    VARCHAR(100),          -- user ID or 'system'
  reason          TEXT,
  previous_status VARCHAR(20),
  new_status      VARCHAR(20),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_env_hibernation_tenant ON environment_hibernation_log(tenant_id);
CREATE INDEX idx_env_hibernation_env ON environment_hibernation_log(environment_id);
CREATE INDEX idx_env_hibernation_action ON environment_hibernation_log(action);
CREATE INDEX idx_env_hibernation_started ON environment_hibernation_log(started_at DESC);

-- environment_ttl_config 表（环境 TTL 配置）
CREATE TABLE IF NOT EXISTS environment_ttl_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  environment_id  UUID REFERENCES environments(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES environment_templates(id) ON DELETE SET NULL,
  max_lifetime_hours INT NOT NULL DEFAULT 24,
  auto_hibernate  BOOLEAN NOT NULL DEFAULT true,
  hibernate_after_hours INT NOT NULL DEFAULT 8,
  auto_delete     BOOLEAN NOT NULL DEFAULT false,
  delete_after_hours INT,
  notification_hours INT[] NOT NULL DEFAULT '{2, 1}',  -- 提前通知时间（小时）
  excluded_hours  INT[] NOT NULL DEFAULT '{}',          -- 豁免时间段
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_env_ttl_tenant ON environment_ttl_config(tenant_id);
CREATE INDEX idx_env_ttl_env ON environment_ttl_config(environment_id);
CREATE INDEX idx_env_ttl_template ON environment_ttl_config(template_id);

-- 修改 environments 表：添加模板和 TTL 相关字段
ALTER TABLE environments
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES environment_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ttl_config_id UUID REFERENCES environment_ttl_config(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hibernation_status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, hibernating, waking
  ADD COLUMN IF NOT EXISTS last_hibernated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_woken_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resource_usage JSONB NOT NULL DEFAULT '{}';

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- environment_templates
ALTER TABLE environment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_environment_templates ON environment_templates
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_env_templates_tenant_rls ON environment_templates(tenant_id);

COMMENT ON POLICY tenant_isolation_environment_templates ON environment_templates IS
    'Tenant isolation RLS policy - environment templates visible only to owning tenant';

-- environment_hibernation_log
ALTER TABLE environment_hibernation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_hibernation_log FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_environment_hibernation_log ON environment_hibernation_log
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_env_hibernation_tenant_rls ON environment_hibernation_log(tenant_id);

COMMENT ON POLICY tenant_isolation_environment_hibernation_log ON environment_hibernation_log IS
    'Tenant isolation RLS policy - hibernation logs visible only to owning tenant';

-- environment_ttl_config
ALTER TABLE environment_ttl_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_ttl_config FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_environment_ttl_config ON environment_ttl_config
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_env_ttl_tenant_rls ON environment_ttl_config(tenant_id);

COMMENT ON POLICY tenant_isolation_environment_ttl_config ON environment_ttl_config IS
    'Tenant isolation RLS policy - TTL configs visible only to owning tenant';
