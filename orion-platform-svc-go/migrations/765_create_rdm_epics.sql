-- Migration 765: RDM Epics — 史诗/大需求
CREATE TABLE IF NOT EXISTS rdm_epics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    project_id      UUID NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'planned',
    -- planned, active, completed, cancelled
    owner_id        TEXT,
    due_date        TEXT,
    story_points    INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, title)
);
CREATE INDEX idx_rdm_epics_project ON rdm_epics(project_id, status);
