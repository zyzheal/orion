-- Migration 385: AI Security Audit Logs PostgreSQL persistence
-- Persist AI Security Service audit logs and blocked requests to PostgreSQL

CREATE TABLE IF NOT EXISTS ai_security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL DEFAULT 'security_event',
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  source_ip INET,
  user_id VARCHAR(200),
  tenant_id VARCHAR(200) NOT NULL DEFAULT 'default',
  action VARCHAR(50) NOT NULL,
  resource TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'recorded',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_security_audit_logs_tenant ON ai_security_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_security_audit_logs_action ON ai_security_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_ai_security_audit_logs_user ON ai_security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_security_audit_logs_severity ON ai_security_audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_ai_security_audit_logs_created ON ai_security_audit_logs(created_at DESC);

COMMENT ON COLUMN ai_security_audit_logs.event_type IS 'Event category: security_violation, input_sanitized, output_validated, sandbox_executed';
COMMENT ON COLUMN ai_security_audit_logs.severity IS 'Severity level: info, warning, error, critical';
COMMENT ON COLUMN ai_security_audit_logs.action IS 'Action taken: input_sanitized, output_validated, sandbox_executed, security_violation';
COMMENT ON COLUMN ai_security_audit_logs.status IS 'Log status: recorded, acknowledged, resolved';

CREATE TABLE IF NOT EXISTS ai_security_blocked_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ip INET NOT NULL,
  user_id VARCHAR(200),
  tenant_id VARCHAR(200) NOT NULL DEFAULT 'default',
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  request_preview TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_security_blocked_requests_tenant ON ai_security_blocked_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_security_blocked_requests_source_ip ON ai_security_blocked_requests(source_ip);
CREATE INDEX IF NOT EXISTS idx_ai_security_blocked_requests_blocked_at ON ai_security_blocked_requests(blocked_at DESC);
