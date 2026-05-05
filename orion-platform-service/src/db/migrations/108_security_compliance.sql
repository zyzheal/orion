-- 108: Security Compliance
-- 合规策略、合规评估、审计发现

-- compliance_policies 表（合规策略定义）
CREATE TABLE IF NOT EXISTS compliance_policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_name       VARCHAR(200) NOT NULL,
  framework         VARCHAR(100) NOT NULL,                      -- soc2, iso27001, gdpr, hipaa, pci-dss, custom
  category          VARCHAR(100) NOT NULL,                      -- access_control, encryption, logging, backup, network
  description       TEXT,
  severity          VARCHAR(20) NOT NULL DEFAULT 'high',        -- critical, high, medium, low
  rule_expression   JSONB NOT NULL DEFAULT '{}',
  auto_remediate    BOOLEAN NOT NULL DEFAULT false,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  version           VARCHAR(20) NOT NULL DEFAULT '1.0',
  effective_from    TIMESTAMPTZ,
  effective_until   TIMESTAMPTZ,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_compliance_policies_tenant ON compliance_policies(tenant_id);
CREATE INDEX idx_compliance_policies_framework ON compliance_policies(framework);
CREATE INDEX idx_compliance_policies_category ON compliance_policies(category);
CREATE INDEX idx_compliance_policies_enabled ON compliance_policies(enabled) WHERE enabled = true;
CREATE INDEX idx_compliance_policies_severity ON compliance_policies(severity);

-- compliance_evaluations 表（合规评估记录）
CREATE TABLE IF NOT EXISTS compliance_evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id         UUID NOT NULL REFERENCES compliance_policies(id) ON DELETE CASCADE,
  evaluation_type   VARCHAR(50) NOT NULL DEFAULT 'scheduled',   -- scheduled, on_demand, continuous
  scope             JSONB NOT NULL DEFAULT '{}',
  status            VARCHAR(30) NOT NULL DEFAULT 'completed',   -- completed, failed, partial, skipped
  result            VARCHAR(30) NOT NULL DEFAULT 'compliant',   -- compliant, non_compliant, not_applicable
  compliance_score  FLOAT DEFAULT 100,
  details           JSONB NOT NULL DEFAULT '{}',
  evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluated_by      VARCHAR(100) NOT NULL
);
CREATE INDEX idx_compliance_evaluations_tenant ON compliance_evaluations(tenant_id);
CREATE INDEX idx_compliance_evaluations_policy ON compliance_evaluations(policy_id);
CREATE INDEX idx_compliance_evaluations_result ON compliance_evaluations(result);
CREATE INDEX idx_compliance_evaluations_evaluated ON compliance_evaluations(evaluated_at DESC);
CREATE INDEX idx_compliance_evaluations_score ON compliance_evaluations(compliance_score);

-- audit_findings 表（审计发现）
CREATE TABLE IF NOT EXISTS audit_findings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evaluation_id     UUID REFERENCES compliance_evaluations(id) ON DELETE SET NULL,
  finding_id        VARCHAR(100) NOT NULL,
  title             VARCHAR(500) NOT NULL,
  description       TEXT NOT NULL,
  severity          VARCHAR(20) NOT NULL,                       -- critical, high, medium, low, info
  category          VARCHAR(100) NOT NULL,
  affected_resource VARCHAR(500),
  recommendation    TEXT,
  status            VARCHAR(30) NOT NULL DEFAULT 'open',        -- open, in_progress, resolved, accepted_risk, dismissed
  assigned_to       VARCHAR(100),
  due_date          TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  resolution_notes  TEXT,
  evidence          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_findings_tenant ON audit_findings(tenant_id);
CREATE INDEX idx_audit_findings_evaluation ON audit_findings(evaluation_id);
CREATE INDEX idx_audit_findings_severity ON audit_findings(severity);
CREATE INDEX idx_audit_findings_status ON audit_findings(status);
CREATE INDEX idx_audit_findings_due ON audit_findings(due_date) WHERE due_date IS NOT NULL;

-- RLS
ALTER TABLE compliance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_compliance_policies ON compliance_policies
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_compliance_evaluations ON compliance_evaluations
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_audit_findings ON audit_findings
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
