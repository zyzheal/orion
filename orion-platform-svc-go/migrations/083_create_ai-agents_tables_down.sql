-- Auto-generated rollback for version 083. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_agent_audit_logs_created";

DROP INDEX IF EXISTS "idx_agent_audit_logs_tenant";

DROP TABLE IF EXISTS "agent_audit_logs" CASCADE;

DROP INDEX IF EXISTS "idx_a_i_agents_created";

DROP INDEX IF EXISTS "idx_a_i_agents_tenant";
