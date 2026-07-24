-- Phase 3: Security Compliance & Multi-Modal Trigger tables

-- ==================== Compliance Framework ====================

CREATE TABLE IF NOT EXISTS compliance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(255) NOT NULL,
    description TEXT,
    framework_type VARCHAR(64) NOT NULL, -- soc2, iso27001, gdpr, hipaa, pci_dss, custom
    requirements JSONB NOT NULL DEFAULT '{}',
    rules JSONB NOT NULL DEFAULT '[]',
    severity_threshold VARCHAR(16) DEFAULT 'high',
    enabled BOOLEAN DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    policy_id UUID NOT NULL REFERENCES compliance_policies(id),
    status VARCHAR(32) DEFAULT 'pending', -- pending, running, completed, failed
    score DECIMAL(5,2) DEFAULT 0,
    total_checks INTEGER DEFAULT 0,
    passed_checks INTEGER DEFAULT 0,
    failed_checks INTEGER DEFAULT 0,
    gaps JSONB DEFAULT '[]',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_remediations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    evaluation_id UUID REFERENCES compliance_evaluations(id),
    gap_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'pending', -- pending, in_progress, completed, failed
    action_taken TEXT,
    result JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- ==================== Security Audit ====================

CREATE TABLE IF NOT EXISTS audit_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(255) NOT NULL,
    description TEXT,
    scope JSONB NOT NULL DEFAULT '{}',
    audit_type VARCHAR(64) NOT NULL, -- security, compliance, performance, access, full
    schedule_type VARCHAR(32) DEFAULT 'manual', -- manual, daily, weekly, monthly
    cron_expression VARCHAR(64),
    reviewers JSONB DEFAULT '[]',
    status VARCHAR(32) DEFAULT 'draft', -- draft, active, completed, cancelled
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES audit_plans(id),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    status VARCHAR(32) DEFAULT 'pending', -- pending, running, completed, failed
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    findings_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES audit_executions(id),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(16) NOT NULL, -- critical, high, medium, low, info
    category VARCHAR(64),
    evidence JSONB,
    recommendation TEXT,
    status VARCHAR(32) DEFAULT 'open', -- open, in_progress, resolved, closed, accepted
    assigned_to VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP
);

-- ==================== Multi-Modal Trigger ====================

CREATE TABLE IF NOT EXISTS triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL, -- webhook, chat, schedule, event, manual
    config JSONB NOT NULL DEFAULT '{}',
    condition_expression TEXT,
    pipeline_id VARCHAR(64),
    enabled BOOLEAN DEFAULT true,
    trigger_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trigger_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id UUID NOT NULL REFERENCES triggers(id),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    event_type VARCHAR(64) NOT NULL,
    event_payload JSONB NOT NULL DEFAULT '{}',
    evaluation_result VARCHAR(32), -- matched, not_matched, error
    pipeline_run_id VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    trigger_id UUID REFERENCES triggers(id),
    path VARCHAR(255) NOT NULL,
    secret VARCHAR(255),
    allowed_ips JSONB DEFAULT '[]',
    method VARCHAR(16) DEFAULT 'POST',
    request_count INTEGER DEFAULT 0,
    last_request_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_policies_tenant ON compliance_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_evaluations_tenant ON compliance_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_evaluations_policy ON compliance_evaluations(policy_id);
CREATE INDEX IF NOT EXISTS idx_audit_plans_tenant ON audit_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_executions_plan ON audit_executions(plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_execution ON audit_findings(execution_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_tenant ON audit_findings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_triggers_tenant ON triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trigger_events_trigger ON trigger_events(trigger_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant ON webhook_endpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_path ON webhook_endpoints(path);

-- ==================== Row Level Security (RLS) Policies ====================

ALTER TABLE compliance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_compliance_policies ON compliance_policies
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE compliance_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_compliance_evaluations ON compliance_evaluations
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE compliance_remediations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_compliance_remediations ON compliance_remediations
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE audit_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_plans ON audit_plans
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE audit_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_executions ON audit_executions
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_findings ON audit_findings
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_triggers ON triggers
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE trigger_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_trigger_events ON trigger_events
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_webhook_endpoints ON webhook_endpoints
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );
