-- Auto-generated rollback for version 235. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_project_members_user";

DROP INDEX IF EXISTS "idx_project_members_project";

DROP INDEX IF EXISTS "idx_project_members_tenant";
