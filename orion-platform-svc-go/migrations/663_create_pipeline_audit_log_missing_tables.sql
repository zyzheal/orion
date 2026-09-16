-- 663_create_pipeline_audit_log_missing_tables.sql
-- pipeline-audit-log 模块: pipeline_audit_logs 表无 CREATE TABLE。
-- 回滚见 663_create_pipeline_audit_log_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS pipeline_audit_logs (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    run_id          UUID,
    stage_id        TEXT NOT NULL DEFAULT '',
    task_id         TEXT NOT NULL DEFAULT '',
    action          TEXT NOT NULL DEFAULT '',
    actor           TEXT NOT NULL DEFAULT '',
    outcome         TEXT NOT NULL DEFAULT '',
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    input_summary   TEXT NOT NULL DEFAULT '',
    output_summary  TEXT NOT NULL DEFAULT '',
    error_message   TEXT NOT NULL DEFAULT '',
    metadata        JSONB DEFAULT '{}',
    resource_type   TEXT NOT NULL DEFAULT '',
    resource_id     TEXT NOT NULL DEFAULT '',
    details         TEXT NOT NULL DEFAULT '',
    ip_address      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_audit_logs_tenant ON pipeline_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_audit_logs_run ON pipeline_audit_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_audit_logs_stage ON pipeline_audit_logs(stage_id);
