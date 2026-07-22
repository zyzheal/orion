-- Rollback Migration 059: Remove extended tenant_quotas columns

ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS max_cpu_cores;
ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS max_memory_gb;
ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS max_tasks_per_pipeline;
ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS max_runners;
ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS api_rate_limit;
ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS api_rate_limit_window_seconds;
ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS max_pipeline_runs_per_day;
