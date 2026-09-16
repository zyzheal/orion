-- 670_create_pipeline_batch_missing_tables.sql
-- 3 个模块: pipeline-batch / pipeline-batch-operations / pipeline-sse。
-- 回滚见 670_create_pipeline_batch_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS pipeline_phase_groups (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    pipeline_id    UUID NOT NULL,
    name           TEXT NOT NULL,
    batch_strategy TEXT NOT NULL DEFAULT 'fixed',
    batch_config   JSONB DEFAULT '{}',
    gate_type      TEXT NOT NULL DEFAULT 'manual',
    status         TEXT NOT NULL DEFAULT 'active',
    created_by     TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_phase_groups_tenant ON pipeline_phase_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_phase_groups_pipeline ON pipeline_phase_groups(pipeline_id);

CREATE TABLE IF NOT EXISTS pipeline_batch_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    phase_group_id  UUID NOT NULL,
    batch_index     INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',
    result          JSONB DEFAULT '{}',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pipeline_batch_runs_tenant ON pipeline_batch_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_batch_runs_phase_group ON pipeline_batch_runs(phase_group_id);

CREATE TABLE IF NOT EXISTS pipeline_batch_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    operation   TEXT NOT NULL,
    target_ids  JSONB DEFAULT '[]',
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_batch_requests_tenant ON pipeline_batch_requests(tenant_id);

CREATE TABLE IF NOT EXISTS pipeline_sse_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    pipeline_id  UUID,
    run_id       UUID,
    stage_id     TEXT NOT NULL DEFAULT '',
    stage_name   TEXT NOT NULL DEFAULT '',
    step_name    TEXT NOT NULL DEFAULT '',
    log_line     TEXT NOT NULL DEFAULT '',
    level        TEXT NOT NULL DEFAULT 'info',
    event_type   TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_sse_events_tenant ON pipeline_sse_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_sse_events_run ON pipeline_sse_events(run_id);
