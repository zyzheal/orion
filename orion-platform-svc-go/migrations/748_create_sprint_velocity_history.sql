-- Migration 748: Sprint velocity history tracking
CREATE TABLE IF NOT EXISTS sprint_velocity_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    sprint_id       UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    committed_points INTEGER NOT NULL DEFAULT 0,
    completed_points INTEGER NOT NULL DEFAULT 0,
    member_count    INTEGER NOT NULL DEFAULT 0,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, sprint_id)
);
CREATE INDEX idx_sprint_velocity_tenant ON sprint_velocity_history(tenant_id);
