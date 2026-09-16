-- 659_create_test_reports_missing_tables.sql
-- test-reports 模块: test-reports 表无 CREATE TABLE。
-- 注: 表名带连字符, 用引号包裹。
-- 回滚见 659_create_test_reports_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS "test-reports" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_test_reports_tenant ON "test-reports"(tenant_id);
