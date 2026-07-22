-- Auto-generated rollback for version 027. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_cron_executions_job";

DROP INDEX IF EXISTS "idx_cron_executions_tenant";

DROP INDEX IF EXISTS "idx_cron_jobs_tenant";

DROP TABLE IF EXISTS "cron_job_executions" CASCADE;

DROP TABLE IF EXISTS "cron_jobs" CASCADE;
