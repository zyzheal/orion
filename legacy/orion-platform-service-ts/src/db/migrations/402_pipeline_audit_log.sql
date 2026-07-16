-- Pipeline Audit Log table (Task 7)
-- Complete pipeline execution audit trail for forensic analysis
-- Mirrors NeatLogic's console_log / node_log pattern

CREATE TABLE IF NOT EXISTS pipeline_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    run_id VARCHAR(64) NOT NULL,
    stage_id VARCHAR(64),
    task_id VARCHAR(64),
    action VARCHAR(64) NOT NULL,  -- stage.start, task.fail, approval.approve, etc.
    actor VARCHAR(255) NOT NULL,  -- userId | 'system' | 'trigger'
    outcome VARCHAR(16) NOT NULL, -- success | failed | pending
    duration_ms INTEGER,
    input_summary JSONB DEFAULT '{}',
    output_summary JSONB DEFAULT '{}',
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pipeline_audit_logs_tenant ON pipeline_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_audit_logs_run ON pipeline_audit_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_audit_logs_stage ON pipeline_audit_logs(stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_audit_logs_action ON pipeline_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_pipeline_audit_logs_created ON pipeline_audit_logs(created_at DESC);

-- Composite index for run audit trail queries
CREATE INDEX IF NOT EXISTS idx_pipeline_audit_logs_run_created
  ON pipeline_audit_logs(run_id, created_at DESC);

-- Row Level Security
ALTER TABLE pipeline_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_pipeline_audit_logs ON pipeline_audit_logs
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );
