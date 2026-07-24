-- Auto-generated rollback for version 039. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_flag_toggle_history_flag";

DROP INDEX IF EXISTS "idx_feature_flags_status";

DROP INDEX IF EXISTS "idx_feature_flags_key";

DROP INDEX IF EXISTS "idx_feature_flags_tenant";
