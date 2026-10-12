-- Migration 766: RDM Milestones — 里程碑
CREATE TABLE IF NOT EXISTS rdm_milestones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    project_id      UUID NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    target_date     TEXT,
    status          TEXT NOT NULL DEFAULT 'planned',
    -- planned, active, completed, missed
    progress_pct    INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, title)
);
CREATE INDEX idx_rdm_milestones_project ON rdm_milestones(project_id, status);
