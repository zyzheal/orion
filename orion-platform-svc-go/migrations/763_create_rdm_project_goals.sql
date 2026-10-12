-- Migration 763: RDM Project Goals — 项目目标管理
CREATE TABLE IF NOT EXISTS rdm_project_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    project_id      UUID NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    goal_type       TEXT NOT NULL DEFAULT 'milestone',
    -- milestone, metric, qualitative
    target_value    TEXT,
    current_value   TEXT,
    priority        TEXT NOT NULL DEFAULT 'medium',
    status          TEXT NOT NULL DEFAULT 'active',
    -- active, achieved, abandoned
    due_date        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, project_id, title)
);
CREATE INDEX idx_rdm_project_goals_project ON rdm_project_goals(project_id);
