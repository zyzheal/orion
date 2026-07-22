-- Auto-generated rollback for version 062. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_hotfix_channels_enabled";

DROP INDEX IF EXISTS "idx_hotfix_channels_product_line_id";

DROP INDEX IF EXISTS "idx_hotfix_channels_tenant_id";

DROP TABLE IF EXISTS "hotfix_channels" CASCADE;

DROP INDEX IF EXISTS "idx_release_trains_state";

DROP INDEX IF EXISTS "idx_release_trains_product_line_id";

DROP INDEX IF EXISTS "idx_release_trains_tenant_id";

DROP TABLE IF EXISTS "release_trains" CASCADE;

DROP INDEX IF EXISTS "idx_product_lines_phase";

DROP INDEX IF EXISTS "idx_product_lines_tenant_id";
