-- Auto-generated rollback for version 063. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_project_members_user_id";

DROP INDEX IF EXISTS "idx_project_members_project_id";

DROP INDEX IF EXISTS "idx_project_members_tenant_id";
