-- 628_create_i18n_missing_tables.sql
-- i18n 模块: i18n_locales 表无 CREATE TABLE。
-- 回滚见 628_create_i18n_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS i18n_locales (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    locale_code  TEXT NOT NULL,
    locale_name  TEXT NOT NULL,
    is_default   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_i18n_locales_tenant ON i18n_locales(tenant_id);
