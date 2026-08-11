-- Migration 380: process-step events/executions + condition groups/expressions

-- Process step lifecycle events
CREATE TABLE IF NOT EXISTS process_step_events (
    id VARCHAR(36) PRIMARY KEY,
    step_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_step_events_step ON process_step_events(step_id);
CREATE INDEX IF NOT EXISTS idx_process_step_events_type ON process_step_events(event_type);

-- Process step executions
CREATE TABLE IF NOT EXISTS process_step_executions (
    id VARCHAR(36) PRIMARY KEY,
    step_id VARCHAR(36) NOT NULL,
    instance_id VARCHAR(128),
    input TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    output TEXT,
    error TEXT,
    duration_ms BIGINT DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_step_executions_step ON process_step_executions(step_id);
CREATE INDEX IF NOT EXISTS idx_process_step_executions_status ON process_step_executions(status);

-- Condition groups
CREATE TABLE IF NOT EXISTS condition_groups (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL,
    children JSONB DEFAULT '[]'::JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_condition_groups_tenant ON condition_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_condition_groups_type ON condition_groups(tenant_id, type);

-- Condition expressions
CREATE TABLE IF NOT EXISTS condition_expressions (
    id VARCHAR(36) PRIMARY KEY,
    group_id VARCHAR(36) NOT NULL,
    field VARCHAR(255) NOT NULL,
    operator VARCHAR(64) NOT NULL,
    value TEXT,
    value_type VARCHAR(64) DEFAULT 'string',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_condition_expr_group FOREIGN KEY (group_id) REFERENCES condition_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_condition_exprs_group ON condition_expressions(group_id);
CREATE INDEX IF NOT EXISTS idx_condition_exprs_field ON condition_expressions(field);