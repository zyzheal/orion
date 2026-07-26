-- Compliance policies table
CREATE TABLE IF NOT EXISTS compliance_policies (
    id            VARCHAR(255) PRIMARY KEY,
    tenant_id     VARCHAR(255) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    framework     VARCHAR(100) NOT NULL,
    category      VARCHAR(100) NOT NULL,
    severity      VARCHAR(50) NOT NULL DEFAULT 'medium',
    status        VARCHAR(50) NOT NULL DEFAULT 'draft',
    rule_type     VARCHAR(100) NOT NULL,
    expression    JSONB DEFAULT '{}'::jsonb,
    action        VARCHAR(100) NOT NULL DEFAULT 'warn',
    enabled       BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_policies_tenant_id ON compliance_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_framework ON compliance_policies(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_status ON compliance_policies(status);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_enabled ON compliance_policies(enabled);
