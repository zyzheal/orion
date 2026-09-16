-- 671_create_pipeline_control_and_trend_missing_tables.sql
-- 3 个模块: pipeline-execution-control / pipeline-trend / pipeline-graph。
-- pipeline-graph 引用 pipeline_definitions 表（已有 004 建表，此处跳过）。
-- 实际只需建 pipeline_execution_control_logs 和 pipeline_trends。
-- 回滚见 671_create_pipeline_control_and_trend_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS pipeline_execution_control_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    run_id     UUID NOT NULL,
    action     TEXT NOT NULL DEFAULT '',
    reason     TEXT NOT NULL DEFAULT '',
    operator   TEXT NOT NULL DEFAULT '',
    metadata   JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_execution_control_logs_tenant ON pipeline_execution_control_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_execution_control_logs_run ON pipeline_execution_control_logs(run_id);

CREATE TABLE IF NOT EXISTS pipeline_trends (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id    UUID NOT NULL,
    success_rate   DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg_duration   INTEGER NOT NULL DEFAULT 0,
    total_runs     INTEGER NOT NULL DEFAULT 0,
    failed_runs    INTEGER NOT NULL DEFAULT 0,
    period         TEXT NOT NULL DEFAULT 'weekly',
    period_start   TIMESTAMPTZ,
    tenant_id      UUID NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_trends_tenant ON pipeline_trends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_trends_pipeline ON pipeline_trends(pipeline_id);
