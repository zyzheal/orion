-- Auto-generated rollback for version 046. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_i18n_translations_key";

DROP INDEX IF EXISTS "idx_i18n_translations_namespace";

DROP INDEX IF EXISTS "idx_i18n_translations_locale_code";

DROP INDEX IF EXISTS "idx_i18n_translations_tenant_id";

DROP TABLE IF EXISTS "i18n_translations" CASCADE;

DROP INDEX IF EXISTS "idx_locales_tenant_id";
