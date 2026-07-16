-- Migration: 385_create_agent_audit_logs.sql
-- Purpose: Persist agent audit logs to PostgreSQL
--          (static in-memory array -> DB-backed audit with memory cache)
-- F004: audit log creation via BaseAgent constructor injection

CREATE TABLE IF NOT EXISTS agent_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(200) NOT NULL,
  agent_type VARCHAR(100),
  action VARCHAR(100) NOT NULL DEFAULT 'execute',
  status VARCHAR(20) NOT NULL,
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id VARCHAR(200),
  trace_id VARCHAR(200),
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  tokens_total INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_audit_logs_agent_id ON agent_audit_logs(agent_id);
CREATE INDEX idx_agent_audit_logs_tenant ON agent_audit_logs(tenant_id);
CREATE INDEX idx_agent_audit_logs_status ON agent_audit_logs(status);
CREATE INDEX idx_agent_audit_logs_created ON agent_audit_logs(created_at DESC);

COMMENT ON COLUMN agent_audit_logs.status IS 'Audit log status: success, failed, error';
