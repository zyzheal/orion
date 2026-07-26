-- Migration 001: Initialize Audit Service Database
-- Creates all required tables for audit logging, compliance tracking, and security compliance

-- Audit Logs Table (blockchain-based chain)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(255) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_hash VARCHAR(64) NOT NULL,
  current_hash VARCHAR(64) NOT NULL,
  chain_index BIGINT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'low',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  tenant_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_chain_index ON audit_logs(chain_index);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_current_hash ON audit_logs(current_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);

-- Compliance Policies Table
CREATE TABLE IF NOT EXISTS compliance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  framework VARCHAR(100) NOT NULL,
  rules JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(30) NOT NULL DEFAULT 'not_evaluated',
  last_evaluated TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_policies_framework ON compliance_policies(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_status ON compliance_policies(status);

-- Compliance Evaluations Table
CREATE TABLE IF NOT EXISTS compliance_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES compliance_policies(id) ON DELETE CASCADE,
  resource_id VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL,
  score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluated_by VARCHAR(255) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_evaluations_policy ON compliance_evaluations(policy_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_resource ON compliance_evaluations(resource_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON compliance_evaluations(status);

-- Compliance Findings Table
CREATE TABLE IF NOT EXISTS compliance_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT,
  remediation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_resource ON compliance_findings(resource_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON compliance_findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_status ON compliance_findings(status);

-- Compliance Reports Table
CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES compliance_policies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL,
  overall_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  total_checks INTEGER NOT NULL DEFAULT 0,
  passed_checks INTEGER NOT NULL DEFAULT 0,
  failed_checks INTEGER NOT NULL DEFAULT 0,
  findings JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by VARCHAR(255) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_policy ON compliance_reports(policy_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_status ON compliance_reports(status);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_generated ON compliance_reports(generated_at DESC);

-- Remediations Table
CREATE TABLE IF NOT EXISTS remediations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES compliance_findings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  assigned_to VARCHAR(255),
  due_date TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remediations_finding ON remediations(finding_id);
CREATE INDEX IF NOT EXISTS idx_remediations_status ON remediations(status);

-- Audit Plans Table
CREATE TABLE IF NOT EXISTS audit_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by VARCHAR(255) NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_plans_status ON audit_plans(status);
CREATE INDEX IF NOT EXISTS idx_audit_plans_created ON audit_plans(created_at DESC);

-- Audit Findings Table
CREATE TABLE IF NOT EXISTS audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_plan_id UUID NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  resource_id VARCHAR(255),
  evidence TEXT,
  recommendation TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_findings_plan ON audit_findings(audit_plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_severity ON audit_findings(severity);
CREATE INDEX IF NOT EXISTS idx_audit_findings_status ON audit_findings(status);

-- Compliance Frameworks Table
CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  categories TEXT[] NOT NULL DEFAULT '{}',
  policies TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compliance Evidence Table
CREATE TABLE IF NOT EXISTS compliance_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES compliance_findings(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(255) NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_by VARCHAR(255) NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_compliance_evidence_finding ON compliance_evidence(finding_id);
CREATE INDEX IF NOT EXISTS idx_compliance_evidence_verified ON compliance_evidence(verified);

-- Gap Analysis Table
CREATE TABLE IF NOT EXISTS gap_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES compliance_policies(id) ON DELETE CASCADE,
  current_status VARCHAR(30) NOT NULL,
  target_status VARCHAR(30) NOT NULL,
  gap_description TEXT NOT NULL,
  remediation_steps TEXT[] NOT NULL DEFAULT '{}',
  estimated_effort VARCHAR(100),
  priority VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gap_analysis_framework ON gap_analysis(framework_id);
CREATE INDEX IF NOT EXISTS idx_gap_analysis_policy ON gap_analysis(policy_id);
CREATE INDEX IF NOT EXISTS idx_gap_analysis_priority ON gap_analysis(priority);

-- Rollback:
-- DROP TABLE IF EXISTS gap_analysis CASCADE;
-- DROP TABLE IF EXISTS compliance_evidence CASCADE;
-- DROP TABLE IF EXISTS compliance_frameworks CASCADE;
-- DROP TABLE IF EXISTS audit_findings CASCADE;
-- DROP TABLE IF EXISTS audit_plans CASCADE;
-- DROP TABLE IF EXISTS remediations CASCADE;
-- DROP TABLE IF EXISTS compliance_reports CASCADE;
-- DROP TABLE IF EXISTS compliance_findings CASCADE;
-- DROP TABLE IF EXISTS compliance_evaluations CASCADE;
-- DROP TABLE IF EXISTS compliance_policies CASCADE;
-- DROP TABLE IF EXISTS audit_logs CASCADE;