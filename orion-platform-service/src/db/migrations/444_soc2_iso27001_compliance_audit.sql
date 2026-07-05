-- Migration 444: SOC2/ISO27001 Compliance Audit Tables
-- Task 4.73: SOC2/ISO27001 audit compliance checking
-- Creates tables for compliance checks, violations, and remediation actions

-- ==================== SOC2/ISO27001 Compliance Violations ====================

CREATE TABLE IF NOT EXISTS compliance_violations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    framework           VARCHAR(32) NOT NULL, -- SOC2, ISO27001
    control_id          VARCHAR(64) NOT NULL, -- CC6.1, CC7.2, A.9.4.2, etc.
    control_name        VARCHAR(255) NOT NULL,
    severity            VARCHAR(16) NOT NULL, -- critical, high, medium, low
    status              VARCHAR(32) NOT NULL DEFAULT 'open', -- open, remediating, resolved, accepted
    description         TEXT NOT NULL,
    evidence            JSONB DEFAULT '{}',
    remediation         TEXT,
    remediation_action  JSONB DEFAULT '{}',
    resolved_at         TIMESTAMPTZ,
    resolved_by         VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_violations_tenant ON compliance_violations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_framework ON compliance_violations(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_control ON compliance_violations(control_id);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_status ON compliance_violations(status);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_severity ON compliance_violations(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_created ON compliance_violations(created_at DESC);

-- ==================== SOC2/ISO27001 Compliance Check Results ====================

CREATE TABLE IF NOT EXISTS compliance_check_results (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    framework           VARCHAR(32) NOT NULL, -- SOC2, ISO27001
    control_id          VARCHAR(64) NOT NULL,
    control_name        VARCHAR(255) NOT NULL,
    status              VARCHAR(16) NOT NULL, -- PASS, FAIL, WARNING
    severity            VARCHAR(16) NOT NULL, -- critical, high, medium, low
    description         TEXT NOT NULL,
    evidence            JSONB DEFAULT '{}',
    remediation         TEXT,
    check_type          VARCHAR(64) NOT NULL, -- access_control, encryption, audit_logging, incident_response, backup
    checked_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_check_results_tenant ON compliance_check_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_check_results_framework ON compliance_check_results(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_check_results_control ON compliance_check_results(control_id);
CREATE INDEX IF NOT EXISTS idx_compliance_check_results_status ON compliance_check_results(status);
CREATE INDEX IF NOT EXISTS idx_compliance_check_results_checked ON compliance_check_results(checked_at DESC);

-- ==================== Compliance Remediation Actions ====================

CREATE TABLE IF NOT EXISTS compliance_remediation_actions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    violation_id        UUID NOT NULL REFERENCES compliance_violations(id) ON DELETE CASCADE,
    action_type         VARCHAR(64) NOT NULL, -- automated, manual, partial
    action_taken        TEXT NOT NULL,
    result              JSONB DEFAULT '{}',
    status              VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed
    performed_by        VARCHAR(255),
    performed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_compliance_remediation_actions_violation ON compliance_remediation_actions(violation_id);
CREATE INDEX IF NOT EXISTS idx_compliance_remediation_actions_tenant ON compliance_remediation_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_remediation_actions_status ON compliance_remediation_actions(status);

-- ==================== Row Level Security (RLS) Policies ====================

ALTER TABLE compliance_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_compliance_violations ON compliance_violations
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE compliance_check_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_compliance_check_results ON compliance_check_results
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE compliance_remediation_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_compliance_remediation_actions ON compliance_remediation_actions
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

-- ==================== Rollback ====================
-- DROP TABLE IF EXISTS compliance_remediation_actions;
-- DROP TABLE IF EXISTS compliance_check_results;
-- DROP TABLE IF EXISTS compliance_violations;
