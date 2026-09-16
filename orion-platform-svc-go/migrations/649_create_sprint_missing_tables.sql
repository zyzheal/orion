-- 649_create_sprint_missing_tables.sql
-- sprint 模块: sprint_ticket 表无 CREATE TABLE。
-- 回滚见 649_create_sprint_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS sprint_ticket (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    sprint_id  UUID NOT NULL,
    ticket_id  UUID NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sprint_ticket_tenant ON sprint_ticket(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sprint_ticket_sprint ON sprint_ticket(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_ticket_ticket ON sprint_ticket(ticket_id);
