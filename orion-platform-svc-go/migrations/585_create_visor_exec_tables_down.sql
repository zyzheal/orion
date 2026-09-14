-- Reversal of 585_create_visor_exec_tables.sql.

DROP INDEX IF EXISTS idx_visor_exec_upload_tasks_tenant;
DROP INDEX IF EXISTS idx_visor_exec_upload_tasks_status;
DROP INDEX IF EXISTS idx_visor_exec_upload_tasks_created;
DROP INDEX IF EXISTS idx_visor_exec_cron_job_logs_tenant;
DROP INDEX IF EXISTS idx_visor_exec_cron_job_logs_job;
DROP INDEX IF EXISTS idx_visor_exec_cron_jobs_tenant;
DROP INDEX IF EXISTS idx_visor_exec_cron_jobs_enabled;
DROP INDEX IF EXISTS idx_visor_exec_cron_jobs_next;
DROP INDEX IF EXISTS idx_visor_exec_templates_tenant;
DROP INDEX IF EXISTS idx_visor_exec_templates_category;
DROP INDEX IF EXISTS idx_visor_exec_details_tenant;
DROP INDEX IF EXISTS idx_visor_exec_details_command;
DROP INDEX IF EXISTS idx_visor_exec_details_hostname;
DROP INDEX IF EXISTS idx_visor_exec_command_logs_tenant;
DROP INDEX IF EXISTS idx_visor_exec_command_logs_status;
DROP INDEX IF EXISTS idx_visor_exec_command_logs_created;

DROP TABLE IF EXISTS visor_exec_upload_tasks;
DROP TABLE IF EXISTS visor_exec_cron_job_logs;
DROP TABLE IF EXISTS visor_exec_cron_jobs;
DROP TABLE IF EXISTS visor_exec_templates;
DROP TABLE IF EXISTS visor_exec_command_log_details;
DROP TABLE IF EXISTS visor_exec_command_logs;
