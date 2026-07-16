-- Migration: 354_create_config_change_tables.sql
-- Purpose: Persist config change management module (change requests + history)

-- Config Change Requests
CREATE TABLE IF NOT EXISTS config_change_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    config_key      VARCHAR(500) NOT NULL,
    config_group    VARCHAR(200),
    environment     VARCHAR(100) NOT NULL DEFAULT 'default',
    change_type     VARCHAR(20) NOT NULL,              -- create, modify, delete
    old_value       JSONB,
    new_value       JSONB,
    reason          TEXT NOT NULL,
    risk_level      VARCHAR(20) NOT NULL DEFAULT 'low', -- low, medium, high, critical
    requester       VARCHAR(200) NOT NULL DEFAULT 'system',
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, executing, executed, failed, rolled_back
    execution_plan  JSONB,
    rollback_plan   JSONB,
    approvals       JSONB DEFAULT '[]',
    required_approvals INTEGER NOT NULL DEFAULT 1,
    executed_at     TIMESTAMPTZ,
    executed_by     VARCHAR(200),
    approved_at     TIMESTAMPTZ,
    approved_by     VARCHAR(200),
    rolled_back_at  TIMESTAMPTZ,
    rolled_back_by  VARCHAR(200),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccr_tenant ON config_change_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccr_status ON config_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_ccr_config_key ON config_change_requests(config_key);
CREATE INDEX IF NOT EXISTS idx_ccr_environment ON config_change_requests(environment);
CREATE INDEX IF NOT EXISTS idx_ccr_requester ON config_change_requests(requester);
CREATE INDEX IF NOT EXISTS idx_ccr_risk_level ON config_change_requests(risk_level);
CREATE INDEX IF NOT EXISTS idx_ccr_created_at ON config_change_requests(created_at DESC);

-- Config Change History
CREATE TABLE IF NOT EXISTS config_change_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    change_request_id UUID REFERENCES config_change_requests(id),
    config_key      VARCHAR(500) NOT NULL,
    config_group    VARCHAR(200),
    environment     VARCHAR(100) NOT NULL,
    action          VARCHAR(100) NOT NULL,
    actor           VARCHAR(200) NOT NULL,
    old_value       JSONB,
    new_value       JSONB,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cch_tenant ON config_change_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cch_cr_id ON config_change_history(change_request_id);
CREATE INDEX IF NOT EXISTS idx_cch_config_key ON config_change_history(config_key);
CREATE INDEX IF NOT EXISTS idx_cch_action ON config_change_history(action);
CREATE INDEX IF NOT EXISTS idx_cch_created_at ON config_change_history(created_at DESC);
