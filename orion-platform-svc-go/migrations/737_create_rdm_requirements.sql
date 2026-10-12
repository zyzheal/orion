-- Migration 737: RDM Requirements — 需求管理模块
-- P0-2: 8+ API 需求管理

CREATE TABLE IF NOT EXISTS rdm_requirements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'draft',
    -- Statuses: draft, review, approved, in_progress, done, cancelled
    priority        TEXT NOT NULL DEFAULT 'medium',
    -- Priorities: low, medium, high, critical
    type            TEXT NOT NULL DEFAULT 'feature',
    -- Types: feature, bug, task, epic, story
    effort_points   INTEGER DEFAULT 0,
    sprint_id       UUID,
    project_id      UUID,
    parent_id       UUID,
    repo_ref        TEXT,
    labels          JSONB NOT NULL DEFAULT '{}',
    severity        TEXT,
    estimated_hours DOUBLE PRECISION,
    actual_hours    DOUBLE PRECISION,
    assignee_id     TEXT,
    created_by      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rdm_requirements_tenant ON rdm_requirements(tenant_id, status);
CREATE INDEX idx_rdm_requirements_sprint ON rdm_requirements(tenant_id, sprint_id);
CREATE INDEX idx_rdm_requirements_project ON rdm_requirements(tenant_id, project_id);
CREATE INDEX idx_rdm_requirements_type ON rdm_requirements(tenant_id, type);
