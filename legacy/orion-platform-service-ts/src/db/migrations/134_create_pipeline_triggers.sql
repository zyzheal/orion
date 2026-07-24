-- Migration 134: Pipeline Trigger Persistence Tables
-- Persists pipeline triggers and execution history to PostgreSQL
-- GAP-11: Previously triggers were stored only in-memory (Map), lost on restart

-- Pipeline triggers table: stores trigger definitions
CREATE TABLE IF NOT EXISTS pipeline_triggers (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    pipeline_id VARCHAR(64) NOT NULL,
    trigger_type VARCHAR(16) NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_triggers_tenant ON pipeline_triggers(tenant_id);
CREATE INDEX idx_pipeline_triggers_pipeline ON pipeline_triggers(pipeline_id);
CREATE INDEX idx_pipeline_triggers_type ON pipeline_triggers(trigger_type);
CREATE INDEX idx_pipeline_triggers_status ON pipeline_triggers(status);
CREATE INDEX idx_pipeline_triggers_tenant_pipeline ON pipeline_triggers(tenant_id, pipeline_id);

-- Pipeline trigger execution history table
CREATE TABLE IF NOT EXISTS pipeline_trigger_executions (
    id VARCHAR(64) PRIMARY KEY,
    trigger_id VARCHAR(64) NOT NULL REFERENCES pipeline_triggers(id) ON DELETE CASCADE,
    run_id VARCHAR(64),
    status VARCHAR(16) NOT NULL,
    context_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_trigger_executions_trigger ON pipeline_trigger_executions(trigger_id);
CREATE INDEX idx_pipeline_trigger_executions_status ON pipeline_trigger_executions(status);
CREATE INDEX idx_pipeline_trigger_executions_executed ON pipeline_trigger_executions(executed_at);
CREATE INDEX idx_pipeline_trigger_executions_run ON pipeline_trigger_executions(run_id);

COMMENT ON TABLE pipeline_triggers IS 'Pipeline trigger definitions (git, webhook, schedule, manual)';
COMMENT ON COLUMN pipeline_triggers.trigger_type IS 'Trigger type: git, webhook, schedule, manual';
COMMENT ON COLUMN pipeline_triggers.trigger_config IS 'Trigger-specific configuration (branch, cron expression, webhook URL, etc.)';
COMMENT ON COLUMN pipeline_triggers.status IS 'Trigger status: active, inactive, failed';

COMMENT ON TABLE pipeline_trigger_executions IS 'Pipeline trigger execution history';
COMMENT ON COLUMN pipeline_trigger_executions.run_id IS 'Associated pipeline run ID (if execution started a run)';
COMMENT ON COLUMN pipeline_trigger_executions.status IS 'Execution status: success, failed, pending';
COMMENT ON COLUMN pipeline_trigger_executions.context_json IS 'Execution context and metadata (error messages, event payload, etc.)';

-- Rollback:
-- DROP TABLE IF EXISTS pipeline_trigger_executions;
-- DROP TABLE IF EXISTS pipeline_triggers;
