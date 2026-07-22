-- Migration 131: Execution Timelines
-- 执行时间线快照，支持可视化回放

CREATE TABLE IF NOT EXISTS execution_timelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(255) NOT NULL,
    task_id VARCHAR(255) NOT NULL,
    plugin_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    duration_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'running',  -- 'running', 'success', 'failed', 'timeout', 'cancelled'
    isolation_tier VARCHAR(20),
    trace_id VARCHAR(255),    -- OpenTelemetry trace ID
    span_id VARCHAR(255),     -- OpenTelemetry span ID
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timeline_id UUID NOT NULL REFERENCES execution_timelines(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,  -- 'start', 'heartbeat', 'log', 'error', 'complete', 'timeout'
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    level VARCHAR(10) NOT NULL DEFAULT 'info',  -- 'debug', 'info', 'warn', 'error'
    message TEXT,
    metadata JSONB,
    sequence_num INTEGER NOT NULL  -- 事件顺序号，用于回放排序
);

CREATE INDEX idx_timeline_run ON execution_timelines(run_id);
CREATE INDEX idx_timeline_task ON execution_timelines(task_id);
CREATE INDEX idx_timeline_tenant ON execution_timelines(tenant_id);
CREATE INDEX idx_timeline_started ON execution_timelines(started_at);
CREATE INDEX idx_event_timeline ON execution_events(timeline_id);
CREATE INDEX idx_event_sequence ON execution_events(timeline_id, sequence_num);

COMMENT ON TABLE execution_timelines IS 'Execution timeline snapshots for visual replay';
COMMENT ON TABLE execution_events IS 'Individual events within an execution timeline';

-- Enable RLS
ALTER TABLE execution_timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_timelines FORCE ROW LEVEL SECURITY;
CREATE POLICY timelines_tenant_isolation ON execution_timelines
    USING (app.current_tenant_id IS NOT NULL AND app.current_tenant_id::uuid = tenant_id);

ALTER TABLE execution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_events FORCE ROW LEVEL SECURITY;
CREATE POLICY events_tenant_isolation ON execution_events
    USING (
        EXISTS (
            SELECT 1 FROM execution_timelines t
            WHERE t.id = execution_events.timeline_id
            AND t.tenant_id::uuid = app.current_tenant_id
        )
    );
