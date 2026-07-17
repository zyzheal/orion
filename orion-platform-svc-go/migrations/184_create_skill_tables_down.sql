-- Auto-generated rollback for version 184. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_skill_audit_logs_created";

DROP INDEX IF EXISTS "idx_skill_audit_logs_tenant";

DROP TABLE IF EXISTS "skill_audit_logs" CASCADE;

DROP INDEX IF EXISTS "idx_skill_reviews_created";

DROP INDEX IF EXISTS "idx_skill_reviews_tenant";

DROP TABLE IF EXISTS "skill_reviews" CASCADE;

DROP INDEX IF EXISTS "idx_skill_executions_created";

DROP INDEX IF EXISTS "idx_skill_executions_tenant";

DROP TABLE IF EXISTS "skill_executions" CASCADE;

DROP INDEX IF EXISTS "idx_skill_instances_created";

DROP INDEX IF EXISTS "idx_skill_instances_tenant";

DROP TABLE IF EXISTS "skill_instances" CASCADE;

DROP INDEX IF EXISTS "idx_skills_created";

DROP INDEX IF EXISTS "idx_skills_tenant";
