-- 107: Config Management
-- 配置变更请求、配置漂移记录、修复日志

-- config_change_requests 表（配置变更请求）
CREATE TABLE IF NOT EXISTS config_change_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  config_scope      VARCHAR(50) NOT NULL,                      -- service, pipeline, infrastructure, security
  config_path       VARCHAR(500) NOT NULL,
  current_value     JSONB NOT NULL DEFAULT '{}',
  proposed_value    JSONB NOT NULL DEFAULT '{}',
  reason            TEXT NOT NULL,
  risk_level        VARCHAR(20) NOT NULL DEFAULT 'medium',     -- low, medium, high, critical
  status            VARCHAR(30) NOT NULL DEFAULT 'draft',      -- draft, pending_review, approved, rejected, applied, rolled_back
  reviewer_id       VARCHAR(100),
  review_comment    TEXT,
  reviewed_at       TIMESTAMPTZ,
  applied_by        VARCHAR(100),
  applied_at        TIMESTAMPTZ,
  rollback_plan     TEXT,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_config_change_requests_tenant ON config_change_requests(tenant_id);
CREATE INDEX idx_config_change_requests_scope ON config_change_requests(config_scope);
CREATE INDEX idx_config_change_requests_status ON config_change_requests(status);
CREATE INDEX idx_config_change_requests_risk ON config_change_requests(risk_level);
CREATE INDEX idx_config_change_requests_created ON config_change_requests(created_at DESC);

-- config_drift_records 表（配置漂移记录）
CREATE TABLE IF NOT EXISTS config_drift_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_scope      VARCHAR(50) NOT NULL,
  config_path       VARCHAR(500) NOT NULL,
  expected_value    JSONB NOT NULL DEFAULT '{}',
  actual_value      JSONB NOT NULL DEFAULT '{}',
  drift_type        VARCHAR(50) NOT NULL,                      -- added, removed, modified
  severity          VARCHAR(20) NOT NULL DEFAULT 'warning',    -- critical, warning, info
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved          BOOLEAN NOT NULL DEFAULT false,
  resolved_at       TIMESTAMPTZ,
  resolution_type   VARCHAR(50),                               -- auto_remediated, manual_fix, accepted
  detected_by       VARCHAR(100) NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_config_drift_records_tenant ON config_drift_records(tenant_id);
CREATE INDEX idx_config_drift_records_scope ON config_drift_records(config_scope);
CREATE INDEX idx_config_drift_records_severity ON config_drift_records(severity);
CREATE INDEX idx_config_drift_records_resolved ON config_drift_records(resolved);
CREATE INDEX idx_config_drift_records_detected ON config_drift_records(detected_at DESC);

-- remediation_logs 表（修复日志）
CREATE TABLE IF NOT EXISTS remediation_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  drift_record_id   UUID REFERENCES config_drift_records(id) ON DELETE SET NULL,
  change_request_id UUID REFERENCES config_change_requests(id) ON DELETE SET NULL,
  remediation_type  VARCHAR(50) NOT NULL,                      -- auto, manual, script, rollback
  action            VARCHAR(200) NOT NULL,
  target_path       VARCHAR(500),
  before_value      JSONB NOT NULL DEFAULT '{}',
  after_value       JSONB NOT NULL DEFAULT '{}',
  status            VARCHAR(30) NOT NULL DEFAULT 'completed',  -- completed, failed, partial
  executed_by       VARCHAR(100) NOT NULL,
  execution_time_ms INT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_remediation_logs_tenant ON remediation_logs(tenant_id);
CREATE INDEX idx_remediation_logs_drift ON remediation_logs(drift_record_id);
CREATE INDEX idx_remediation_logs_change ON remediation_logs(change_request_id);
CREATE INDEX idx_remediation_logs_type ON remediation_logs(remediation_type);
CREATE INDEX idx_remediation_logs_status ON remediation_logs(status);

-- RLS
ALTER TABLE config_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_drift_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_config_change_requests ON config_change_requests
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_config_drift_records ON config_drift_records
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_remediation_logs ON remediation_logs
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
