-- Create masking_rules table for data-masking module
CREATE TABLE IF NOT EXISTS masking_rules (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    strategy VARCHAR(64) NOT NULL,
    field_pattern VARCHAR(256) NOT NULL,
    resource_type VARCHAR(128),
    replacement VARCHAR(32),
    classification_level VARCHAR(64),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_masking_rules_tenant ON masking_rules(tenant_id);
CREATE INDEX idx_masking_rules_resource ON masking_rules(tenant_id, resource_type, enabled);
