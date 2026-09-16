-- 638_create_product_line_missing_tables.sql
-- product-line 模块: environment_mappings 表无 CREATE TABLE。
-- 回滚见 638_create_product_line_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS environment_mappings (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_line_id    UUID NOT NULL,
    tenant_id          UUID NOT NULL,
    branch_pattern     TEXT NOT NULL DEFAULT '',
    environment        TEXT NOT NULL DEFAULT '',
    requires_approval  BOOLEAN NOT NULL DEFAULT FALSE,
    priority           INTEGER NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_environment_mappings_product_line ON environment_mappings(product_line_id);
CREATE INDEX IF NOT EXISTS idx_environment_mappings_tenant ON environment_mappings(tenant_id);
