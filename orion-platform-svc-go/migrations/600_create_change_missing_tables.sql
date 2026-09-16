-- 600_create_change_missing_tables.sql
-- change 模块: change_requests 表已由 018 创建，但缺 8 列；
-- 其余 4 张表（timeline_events / rfcs / cab_meetings / cab_decisions）无 CREATE TABLE。
-- 回滚见 600_create_change_missing_tables_down.sql。

-- 1. 为已存在的 change_requests 补齐 8 列。
-- 注: 原 018 已建 change_requests 列 = {id, tenant_id, title, description, type, risk_level, status,
-- impact_scope, rollback_plan, scheduled_start, scheduled_end, created_by, created_at, updated_at}。
-- 旧列 type 与新 schema 的 change_type 是不同列名, 此处新增 change_type 而非复用。
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS change_type   TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS priority      TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS assigned_to   TEXT NOT NULL DEFAULT '';
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS requester_id  TEXT NOT NULL DEFAULT '';
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS branch        TEXT NOT NULL DEFAULT '';
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS target_env    TEXT NOT NULL DEFAULT '';
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS image_digest  TEXT NOT NULL DEFAULT '';
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS approval_id  TEXT NOT NULL DEFAULT '';

-- 2. change_timeline_events
CREATE TABLE IF NOT EXISTS change_timeline_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL,
    tenant_id         UUID NOT NULL,
    event_type        TEXT NOT NULL DEFAULT '',
    description       TEXT NOT NULL DEFAULT '',
    metadata          JSONB DEFAULT '{}',
    created_by        TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_change_timeline_events_cr ON change_timeline_events(change_request_id);
CREATE INDEX IF NOT EXISTS idx_change_timeline_events_tenant ON change_timeline_events(tenant_id);

-- 3. change_rfcs
CREATE TABLE IF NOT EXISTS change_rfcs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    change_request_id UUID NOT NULL,
    rfc_number        TEXT NOT NULL DEFAULT '',
    title             TEXT NOT NULL DEFAULT '',
    description       TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'draft',
    created_by        TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_change_rfcs_tenant ON change_rfcs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_change_rfcs_cr ON change_rfcs(change_request_id);

-- 4. cab_meetings
CREATE TABLE IF NOT EXISTS cab_meetings (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    title        TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'scheduled',
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cab_meetings_tenant ON cab_meetings(tenant_id);

-- 5. cab_decisions
CREATE TABLE IF NOT EXISTS cab_decisions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    cab_meeting_id    UUID,
    change_request_id UUID,
    decision          TEXT NOT NULL DEFAULT '',
    notes             TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cab_decisions_tenant ON cab_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cab_decisions_meeting ON cab_decisions(cab_meeting_id);
CREATE INDEX IF NOT EXISTS idx_cab_decisions_cr ON cab_decisions(change_request_id);
