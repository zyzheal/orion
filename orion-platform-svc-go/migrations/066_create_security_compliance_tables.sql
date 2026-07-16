-- Security Compliance module tables

CREATE TABLE IF NOT EXISTS compliance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    framework VARCHAR(100) NOT NULL,
    rules TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_policies_tenant_id ON compliance_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_framework ON compliance_policies(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_status ON compliance_policies(status);

CREATE TABLE IF NOT EXISTS compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    policy_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    score DOUBLE PRECISION DEFAULT 0,
    failures TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant_id ON compliance_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_policy_id ON compliance_reports(policy_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_status ON compliance_reports(status);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_created_at ON compliance_reports(created_at DESC);

CREATE TABLE IF NOT EXISTS compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(100),
    controls TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_frameworks_tenant_id ON compliance_frameworks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_frameworks_name ON compliance_frameworks(name);

CREATE TABLE IF NOT EXISTS audit_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    schedule VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_plans_tenant_id ON audit_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_plans_status ON audit_plans(status);

CREATE TABLE IF NOT EXISTS audit_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    plan_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    result TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_audit_executions_tenant_id ON audit_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_executions_plan_id ON audit_executions(plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_executions_status ON audit_executions(status);

CREATE TABLE IF NOT EXISTS audit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    execution_id VARCHAR(255) NOT NULL,
    summary TEXT,
    findings_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_reports_tenant_id ON audit_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_execution_id ON audit_reports(execution_id);

CREATE TABLE IF NOT EXISTS audit_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    report_id VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_findings_tenant_id ON audit_findings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_report_id ON audit_findings(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_severity ON audit_findings(severity);
CREATE INDEX IF NOT EXISTS idx_audit_findings_status ON audit_findings(status);

CREATE TABLE IF NOT EXISTS compliance_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    policy_id VARCHAR(255) NOT NULL,
    source VARCHAR(255),
    data TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'collected',
    collected_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_evidence_tenant_id ON compliance_evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_evidence_policy_id ON compliance_evidence(policy_id);
CREATE INDEX IF NOT EXISTS idx_compliance_evidence_status ON compliance_evidence(status);
