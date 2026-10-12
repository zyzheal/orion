-- Migration 764: RDM Backlog Items — 产品待办列表
CREATE TABLE IF NOT EXISTS rdm_backlog_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    project_id      UUID NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    story_points    INTEGER,
    priority        TEXT NOT NULL DEFAULT 'medium',
    status          TEXT NOT NULL DEFAULT 'backlog',
    -- backlog, sprint, in_progress, done
    labels          TEXT[] DEFAULT '{}',
    created_by      TEXT NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rdm_backlog_items_project ON rdm_backlog_items(project_id, status);
CREATE INDEX idx_rdm_backlog_items_tenant ON rdm_backlog_items(tenant_id);
