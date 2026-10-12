-- Migration 753: Inspection schedules — cron-based scheduled inspections
CREATE TABLE IF NOT EXISTS inspection_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    cron_expr       TEXT NOT NULL,
    template_id     UUID NOT NULL REFERENCES inspection_templates(id) ON DELETE CASCADE,
    target_config   JSONB NOT NULL DEFAULT '{}',
    next_run_at     TIMESTAMPTZ,
    last_run_at     TIMESTAMPTZ,
    last_result     TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_inspection_schedules_tenant ON inspection_schedules(tenant_id, enabled);
CREATE INDEX idx_inspection_schedules_next_run ON inspection_schedules(next_run_at) WHERE enabled = TRUE;
