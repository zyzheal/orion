-- 635_create_page_registry_missing_tables.sql
-- page-registry 模块: page_registry_history 表无 CREATE TABLE。
-- 回滚见 635_create_page_registry_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS page_registry_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id     TEXT NOT NULL,
    tenant_id   UUID NOT NULL,
    action      TEXT NOT NULL DEFAULT '',
    changed_by  TEXT NOT NULL DEFAULT '',
    changes     JSONB DEFAULT '{}',
    new_value   TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_page_registry_history_page ON page_registry_history(page_id);
CREATE INDEX IF NOT EXISTS idx_page_registry_history_tenant ON page_registry_history(tenant_id);
