-- 662_create_incident_missing_tables.sql
-- incident 模块: incident_timeline 表无 CREATE TABLE。
-- 注: incident 主表 (incident) 已由 014 创建, 此模块只缺子表 incident_timeline。
-- 回滚见 662_create_incident_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS incident_timeline (
    id           UUID PRIMARY KEY,
    incident_id  UUID NOT NULL,
    tenant_id    UUID NOT NULL,
    event_type   TEXT NOT NULL,
    actor_id     UUID,
    content      TEXT NOT NULL DEFAULT '',
    metadata     JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident ON incident_timeline(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_tenant ON incident_timeline(tenant_id);
