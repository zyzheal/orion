-- Auto-generated rollback for version 074. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_team_roles_team_id";

DROP INDEX IF EXISTS "idx_team_roles_tenant_id";

DROP TABLE IF EXISTS "team_roles" CASCADE;

DROP INDEX IF EXISTS "idx_team_members_user_id";

DROP INDEX IF EXISTS "idx_team_members_team_id";

DROP INDEX IF EXISTS "idx_team_members_tenant_id";

DROP TABLE IF EXISTS "team_members" CASCADE;

DROP INDEX IF EXISTS "idx_teams_team_type";

DROP INDEX IF EXISTS "idx_teams_parent_team_id";

DROP INDEX IF EXISTS "idx_teams_tenant_id";
