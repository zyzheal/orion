-- Migration 002: Create incidents, approvals, and executions tables
-- for full self-healing business logic port from Node.js.

-- Healing incidents table
CREATE TABLE IF NOT EXISTS healing_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    alert_id VARCHAR(128),
    type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'info',
    app_name VARCHAR(256) NOT NULL,
    environment VARCHAR(128) NOT NULL DEFAULT 'default',
    strategy_id VARCHAR(128),
    strategy_name VARCHAR(256),
    actions JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(32) NOT NULL DEFAULT 'new',
    attempts INT NOT NULL DEFAULT 0,
    approval_status VARCHAR(32),
    approval_request_id UUID,
    result JSONB,
    error TEXT,
    tags JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_incidents_tenant ON healing_incidents(tenant_id, started_at DESC);
CREATE INDEX idx_incidents_status ON healing_incidents(status);
CREATE INDEX idx_incidents_app_env ON healing_incidents(app_name, environment);
CREATE INDEX idx_incidents_type ON healing_incidents(type);

-- Approval requests table
CREATE TABLE IF NOT EXISTS healing_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    incident_id UUID NOT NULL REFERENCES healing_incidents(id),
    title VARCHAR(512) NOT NULL,
    description TEXT,
    risk_level VARCHAR(32) NOT NULL DEFAULT 'medium',
    recommended_actions JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    requested_by VARCHAR(256) NOT NULL DEFAULT 'system',
    approved_by VARCHAR(256),
    approval_reason TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_approvals_status ON healing_approvals(status);
CREATE INDEX idx_approvals_incident ON healing_approvals(incident_id);
CREATE INDEX idx_approvals_tenant ON healing_approvals(tenant_id);

-- Rule executions table (enhanced)
CREATE TABLE IF NOT EXISTS healing_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL,
    trigger_event JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_executions_rule ON healing_executions(rule_id, started_at DESC);
