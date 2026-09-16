-- 617_create_application_missing_tables.sql
-- application 模块: applications 表无 CREATE TABLE。
-- 回滚见 617_create_application_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS applications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    tenant_id  UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_applications_tenant ON applications(tenant_id);
