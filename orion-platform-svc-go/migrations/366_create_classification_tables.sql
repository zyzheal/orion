-- Create classification tables for data-classification module
CREATE TABLE IF NOT EXISTS classification_rules (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    level VARCHAR(32) NOT NULL,
    pattern TEXT NOT NULL,
    resource_type VARCHAR(128),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_classification_rules_tenant ON classification_rules(tenant_id);

CREATE TABLE IF NOT EXISTS classified_resources (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    resource_id VARCHAR(256) NOT NULL,
    resource_type VARCHAR(128),
    level VARCHAR(32),
    rule_id VARCHAR(36),
    classified_by VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_classified_resources_tenant ON classified_resources(tenant_id);
CREATE INDEX idx_classified_resources_resource ON classified_resources(tenant_id, resource_id);
