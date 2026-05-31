-- Migration 285: Approval Flow Configs Persistence
-- Migrates approval flow configs from in-memory Map to PostgreSQL

CREATE TABLE IF NOT EXISTS approval_flow_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  flow_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  capability_ids JSONB DEFAULT '[]',
  environments JSONB DEFAULT '[]',
  min_risk_level INT DEFAULT 1,
  max_risk_level INT DEFAULT 4,
  priority INT DEFAULT 0,
  nodes JSONB NOT NULL DEFAULT '[]',
  version INT DEFAULT 1,
  created_by VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, flow_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_flow_configs_tenant ON approval_flow_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_flow_configs_flow_id ON approval_flow_configs(flow_id);

CREATE TABLE IF NOT EXISTS approval_approver_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  flow_id UUID REFERENCES approval_flow_configs(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  rule_type VARCHAR(30) NOT NULL,
  rule_value VARCHAR(200) NOT NULL,
  backup_approvers JSONB DEFAULT '[]',
  fallback_chain JSONB DEFAULT '[]',
  backup_timeout_minutes INT DEFAULT 30,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_approver_rules_tenant ON approval_approver_rules(tenant_id);

CREATE TABLE IF NOT EXISTS approval_fallback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  approval_id VARCHAR(200) NOT NULL,
  node_id VARCHAR(100) NOT NULL,
  fallback_type VARCHAR(30) NOT NULL,
  from_approver VARCHAR(200),
  to_approver VARCHAR(200),
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_fallback_logs_tenant ON approval_fallback_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_fallback_logs_approval ON approval_fallback_logs(approval_id);
