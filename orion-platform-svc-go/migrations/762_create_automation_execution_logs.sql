-- Migration 762: Automation Execution Logs — 自动化执行日志
CREATE TABLE IF NOT EXISTS automation_execution_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    workflow_id     UUID NOT NULL,
    execution_id    UUID NOT NULL,
    node_id         TEXT NOT NULL,
    status          TEXT NOT NULL,
    -- pending, running, success, failed, skipped
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    duration_ms     INTEGER,
    output          JSONB,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_automation_execution_logs_execution ON automation_execution_logs(execution_id);
CREATE INDEX idx_automation_execution_logs_workflow ON automation_execution_logs(workflow_id, created_at DESC);
