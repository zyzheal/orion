-- Migration 738: Ticket 扩展 6 个 RDM 字段
-- P0-4: parent_id/sprint_id/repo_ref/labels/story_points/severity

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS parent_id UUID,
    ADD COLUMN IF NOT EXISTS sprint_id UUID,
    ADD COLUMN IF NOT EXISTS repo_ref TEXT,
    ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS story_points INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS severity TEXT;

CREATE INDEX IF NOT EXISTS idx_tickets_parent ON tickets(tenant_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_tickets_sprint ON tickets(tenant_id, sprint_id);
