-- I18n module tables

CREATE TABLE IF NOT EXISTS locales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    locale_code VARCHAR(50) NOT NULL,
    locale_name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id, locale_code)
);

CREATE INDEX IF NOT EXISTS idx_locales_tenant_id ON locales(tenant_id);

CREATE TABLE IF NOT EXISTS i18n_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    locale_code VARCHAR(50) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_i18n_translations_tenant_id ON i18n_translations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_i18n_translations_locale_code ON i18n_translations(locale_code);
CREATE INDEX IF NOT EXISTS idx_i18n_translations_namespace ON i18n_translations(namespace);
CREATE INDEX IF NOT EXISTS idx_i18n_translations_key ON i18n_translations(key);
