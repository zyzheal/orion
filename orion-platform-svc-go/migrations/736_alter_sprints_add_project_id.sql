-- Migration 736: Sprint 补 ProjectID 外键 + 关联查询
-- 当前 0 命中 project_id，RDM 前后端契约 100% 断裂

ALTER TABLE sprints
    ADD COLUMN IF NOT EXISTS project_id UUID,
    ADD COLUMN IF NOT EXISTS goal TEXT,
    ADD COLUMN IF NOT EXISTS capacity_points INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS velocity_points INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS retrospective TEXT;

-- Add foreign key to projects
ALTER TABLE sprints
    ADD CONSTRAINT fk_sprints_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(tenant_id, project_id);
