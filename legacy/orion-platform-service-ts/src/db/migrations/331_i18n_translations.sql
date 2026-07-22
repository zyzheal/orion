-- Migration 331: i18n Translations (国际化)
-- 多语言翻译存储

CREATE TABLE IF NOT EXISTS i18n_locales (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    locale_code     TEXT NOT NULL,
    locale_name     TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, locale_code)
);

ALTER TABLE i18n_locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE i18n_locales FORCE ROW LEVEL SECURITY;
CREATE POLICY i18n_locales_tenant_isolation ON i18n_locales
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS i18n_translations (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    locale_code     TEXT NOT NULL,
    namespace       TEXT NOT NULL DEFAULT 'common',
    key             TEXT NOT NULL,
    value           TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, locale_code, namespace, key)
);

CREATE INDEX idx_i18n_translations_tenant ON i18n_translations(tenant_id);
CREATE INDEX idx_i18n_translations_locale ON i18n_translations(locale_code, namespace);

ALTER TABLE i18n_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE i18n_translations FORCE ROW LEVEL SECURITY;
CREATE POLICY i18n_translations_tenant_isolation ON i18n_translations
    USING (tenant_id = current_setting('app.current_tenant_id', true));
