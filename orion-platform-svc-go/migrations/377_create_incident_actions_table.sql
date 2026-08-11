-- Incident action module tables — incident remediation action registry
-- Migration 377

CREATE TABLE IF NOT EXISTS incident_actions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_actions_tenant ON incident_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incident_actions_enabled ON incident_actions(tenant_id, enabled);