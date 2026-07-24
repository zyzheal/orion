-- API Governance module tables

CREATE TABLE IF NOT EXISTS api_governance_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    api_name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    request_schema JSONB DEFAULT '{}',
    response_schema JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    deprecation_date TIMESTAMP WITH TIME ZONE,
    retirement_date TIMESTAMP WITH TIME ZONE,
    replacement_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ag_contracts_tenant_id ON api_governance_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ag_contracts_api_name ON api_governance_contracts(api_name);
CREATE INDEX IF NOT EXISTS idx_ag_contracts_status ON api_governance_contracts(status);
CREATE INDEX IF NOT EXISTS idx_ag_contracts_created_at ON api_governance_contracts(created_at DESC);

CREATE TABLE IF NOT EXISTS api_governance_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    contract_id UUID REFERENCES api_governance_contracts(id),
    api_name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    deprecation_date TIMESTAMP WITH TIME ZONE,
    retirement_date TIMESTAMP WITH TIME ZONE,
    replacement_version VARCHAR(50),
    changelog TEXT,
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ag_versions_tenant_id ON api_governance_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ag_versions_contract_id ON api_governance_versions(contract_id);
CREATE INDEX IF NOT EXISTS idx_ag_versions_version ON api_governance_versions(version);
CREATE INDEX IF NOT EXISTS idx_ag_versions_status ON api_governance_versions(status);
CREATE INDEX IF NOT EXISTS idx_ag_versions_registered_at ON api_governance_versions(registered_at DESC);

CREATE TABLE IF NOT EXISTS api_governance_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES api_governance_contracts(id),
    violation_type VARCHAR(100) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ag_violations_contract_id ON api_governance_violations(contract_id);
CREATE INDEX IF NOT EXISTS idx_ag_violations_severity ON api_governance_violations(severity);
CREATE INDEX IF NOT EXISTS idx_ag_violations_detected_at ON api_governance_violations(detected_at DESC);

CREATE TABLE IF NOT EXISTS api_governance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ag_rules_tenant_id ON api_governance_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ag_rules_enabled ON api_governance_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_ag_rules_created_at ON api_governance_rules(created_at DESC);

CREATE TABLE IF NOT EXISTS api_governance_verification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES api_governance_contracts(id),
    passed BOOLEAN NOT NULL,
    violations JSONB DEFAULT '[]',
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ag_verification_history_contract_id ON api_governance_verification_history(contract_id);
CREATE INDEX IF NOT EXISTS idx_ag_verification_history_verified_at ON api_governance_verification_history(verified_at DESC);
