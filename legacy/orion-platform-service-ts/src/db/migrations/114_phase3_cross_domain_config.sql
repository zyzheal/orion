-- 094: Phase 3 Cross-Domain Orchestration & Config Management Enhancement
-- 跨域编排 + 配置管理增强

-- ============================================================
-- Cross-Domain Orchestration Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS cross_domain_orchestrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending, running, paused, completed, failed, aborted, compensating, compensated
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  error TEXT,
  domains JSONB NOT NULL DEFAULT '[]',  -- list of domain names involved
  current_step VARCHAR(255),
  step_count INT NOT NULL DEFAULT 0,
  completed_steps INT NOT NULL DEFAULT 0,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_orchestrations_tenant ON cross_domain_orchestrations(tenant_id);
CREATE INDEX idx_orchestrations_status ON cross_domain_orchestrations(status);
CREATE INDEX idx_orchestrations_created_at ON cross_domain_orchestrations(created_at DESC);

CREATE TABLE IF NOT EXISTS cross_domain_orchestration_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestration_id UUID NOT NULL REFERENCES cross_domain_orchestrations(id) ON DELETE CASCADE,
  step_name VARCHAR(255) NOT NULL,
  domain_name VARCHAR(255) NOT NULL,
  sequence INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending, executing, completed, failed, compensating, compensated, skipped
  input JSONB DEFAULT '{}',
  output JSONB,
  error TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  compensation_started_at TIMESTAMPTZ,
  compensation_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orchestration_steps_orchestration ON cross_domain_orchestration_steps(orchestration_id);
CREATE INDEX idx_orchestration_steps_sequence ON cross_domain_orchestration_steps(orchestration_id, sequence);
CREATE INDEX idx_orchestration_steps_domain ON cross_domain_orchestration_steps(domain_name);

CREATE TABLE IF NOT EXISTS domain_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  domain_name VARCHAR(255) NOT NULL,
  endpoint VARCHAR(512) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',  -- active, inactive, error
  auth_config JSONB DEFAULT '{}',
  health_status VARCHAR(30) DEFAULT 'unknown',
  last_health_check TIMESTAMPTZ,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, domain_name)
);
CREATE INDEX idx_domain_connectors_tenant ON domain_connectors(tenant_id);

CREATE TABLE IF NOT EXISTS cross_domain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestration_id UUID REFERENCES cross_domain_orchestrations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  domain_a VARCHAR(255) NOT NULL,
  domain_b VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending, executing, committed, rolled_back, failed
  payload JSONB NOT NULL DEFAULT '{}',
  compensation_log JSONB DEFAULT '[]',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_cross_domain_transactions_orchestration ON cross_domain_transactions(orchestration_id);
CREATE INDEX idx_cross_domain_transactions_tenant ON cross_domain_transactions(tenant_id);

-- ============================================================
-- Config Management Enhancement Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS config_change_requests_enhanced (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  config_key VARCHAR(255) NOT NULL,
  config_group VARCHAR(255),
  environment VARCHAR(50) NOT NULL DEFAULT 'default',
  change_type VARCHAR(50) NOT NULL DEFAULT 'modify',  -- create, modify, delete
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  risk_level VARCHAR(30) DEFAULT 'low',  -- low, medium, high, critical
  requester VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, approved, rejected, executing, executed, failed, rolled_back
  execution_plan JSONB,
  rollback_plan JSONB,
  approvals JSONB DEFAULT '[]',
  required_approvals INT NOT NULL DEFAULT 1,
  executed_at TIMESTAMPTZ,
  executed_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  approved_by VARCHAR(255),
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_config_change_reqs_enhanced_tenant ON config_change_requests_enhanced(tenant_id);
CREATE INDEX idx_config_change_reqs_enhanced_status ON config_change_requests_enhanced(status);
CREATE INDEX idx_config_change_reqs_enhanced_environment ON config_change_requests_enhanced(environment);
CREATE INDEX idx_config_change_reqs_enhanced_group ON config_change_requests_enhanced(config_group);

CREATE TABLE IF NOT EXISTS config_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  change_request_id UUID REFERENCES config_change_requests_enhanced(id),
  config_key VARCHAR(255) NOT NULL,
  config_group VARCHAR(255),
  environment VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,  -- submitted, approved, rejected, executed, rolled_back, failed
  actor VARCHAR(255) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_config_change_history_tenant ON config_change_history(tenant_id);
CREATE INDEX idx_config_change_history_request ON config_change_history(change_request_id);
CREATE INDEX idx_config_change_history_key ON config_change_history(config_key);

CREATE TABLE IF NOT EXISTS config_drift_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  config_group VARCHAR(255),
  drift_status VARCHAR(30) NOT NULL DEFAULT 'in_sync',  -- in_sync, drift_detected, remediating, remediated, remediation_failed
  expected_config JSONB NOT NULL DEFAULT '{}',
  actual_config JSONB NOT NULL DEFAULT '{}',
  drift_items JSONB DEFAULT '[]',
  total_drifts INT NOT NULL DEFAULT 0,
  critical_drifts INT NOT NULL DEFAULT 0,
  auto_remediation_enabled BOOLEAN DEFAULT false,
  remediation_log JSONB DEFAULT '[]',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_config_drift_reports_tenant ON config_drift_reports(tenant_id);
CREATE INDEX idx_config_drift_reports_group ON config_drift_reports(config_group);
CREATE INDEX idx_config_drift_reports_status ON config_drift_reports(drift_status);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

ALTER TABLE cross_domain_orchestrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_cross_domain_orchestrations ON cross_domain_orchestrations
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE cross_domain_orchestration_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_cross_domain_orchestration_steps ON cross_domain_orchestration_steps
    USING (
        orchestration_id IN (
            SELECT id FROM cross_domain_orchestrations
            WHERE current_setting('app.current_tenant_id', true) IS NOT NULL
              AND current_setting('app.current_tenant_id', true) != ''
              AND tenant_id::text = current_setting('app.current_tenant_id')
        )
    );

ALTER TABLE domain_connectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_domain_connectors ON domain_connectors
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE cross_domain_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_cross_domain_transactions ON cross_domain_transactions
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE config_change_requests_enhanced ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_config_change_requests_enhanced ON config_change_requests_enhanced
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE config_change_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_config_change_history ON config_change_history
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE config_drift_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_config_drift_reports ON config_drift_reports
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );
