-- Policy module tables

CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rego TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policies_tenant_id ON policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_enabled ON policies(enabled);

CREATE TABLE IF NOT EXISTS policy_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    policy_id VARCHAR(255) NOT NULL,
    run_id VARCHAR(255),
    resource_id VARCHAR(255),
    input_json TEXT,
    output_json TEXT,
    decision VARCHAR(50) NOT NULL DEFAULT 'unknown',
    executed_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_evaluations_tenant_id ON policy_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_policy_id ON policy_evaluations(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_decision ON policy_evaluations(decision);
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_created_at ON policy_evaluations(created_at DESC);

CREATE TABLE IF NOT EXISTS policy_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    policy_id VARCHAR(255) NOT NULL,
    evaluation_id VARCHAR(255),
    run_id VARCHAR(255),
    severity VARCHAR(50) NOT NULL DEFAULT 'warning',
    message TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_violations_tenant_id ON policy_violations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_violations_policy_id ON policy_violations(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_violations_status ON policy_violations(status);
CREATE INDEX IF NOT EXISTS idx_policy_violations_severity ON policy_violations(severity);

CREATE TABLE IF NOT EXISTS policy_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    policy_id VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255),
    override_by VARCHAR(255),
    reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_overrides_tenant_id ON policy_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_overrides_policy_id ON policy_overrides(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_overrides_resource_id ON policy_overrides(resource_id);
CREATE INDEX IF NOT EXISTS idx_policy_overrides_expires_at ON policy_overrides(expires_at);

CREATE TABLE IF NOT EXISTS policy_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    source_url VARCHAR(512),
    version VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_bundles_tenant_id ON policy_bundles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_bundles_status ON policy_bundles(status);

CREATE TABLE IF NOT EXISTS policy_exemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    violation_id VARCHAR(255) NOT NULL,
    policy_id VARCHAR(255),
    run_id VARCHAR(255),
    reason TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    requested_by VARCHAR(255),
    reviewed_by VARCHAR(255),
    review_note TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_exemptions_tenant_id ON policy_exemptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_exemptions_violation_id ON policy_exemptions(violation_id);
CREATE INDEX IF NOT EXISTS idx_policy_exemptions_policy_id ON policy_exemptions(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_exemptions_status ON policy_exemptions(status);
CREATE INDEX IF NOT EXISTS idx_policy_exemptions_category ON policy_exemptions(category);
