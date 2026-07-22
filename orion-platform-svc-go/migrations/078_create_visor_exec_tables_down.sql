-- Auto-generated rollback for version 078. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_upload_tasks_created_at";

DROP INDEX IF EXISTS "idx_upload_tasks_status";

DROP INDEX IF EXISTS "idx_upload_tasks_tenant_id";

DROP TABLE IF EXISTS "upload_tasks" CASCADE;

DROP INDEX IF EXISTS "idx_cron_job_logs_created_at";

DROP INDEX IF EXISTS "idx_cron_job_logs_job_id";

DROP INDEX IF EXISTS "idx_cron_job_logs_tenant_id";

DROP TABLE IF EXISTS "cron_job_logs" CASCADE;

DROP INDEX IF EXISTS "idx_cron_jobs_next_run_at";

DROP INDEX IF EXISTS "idx_cron_jobs_enabled";

DROP INDEX IF EXISTS "idx_cron_jobs_tenant_id";

DROP TABLE IF EXISTS "cron_jobs" CASCADE;

DROP INDEX IF EXISTS "idx_script_templates_category";

DROP INDEX IF EXISTS "idx_script_templates_tenant_id";

DROP TABLE IF EXISTS "script_templates" CASCADE;

DROP INDEX IF EXISTS "idx_command_log_details_status";

DROP INDEX IF EXISTS "idx_command_log_details_hostname";

DROP INDEX IF EXISTS "idx_command_log_details_command_id";

DROP INDEX IF EXISTS "idx_command_log_details_tenant_id";

DROP TABLE IF EXISTS "command_log_details" CASCADE;

DROP INDEX IF EXISTS "idx_command_logs_created_at";

DROP INDEX IF EXISTS "idx_command_logs_status";

DROP INDEX IF EXISTS "idx_command_logs_tenant_id";
