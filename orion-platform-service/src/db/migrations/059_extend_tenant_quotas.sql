-- Migration 059: Extend tenant_quotas with additional quota fields
-- Add missing columns for complete TenantQuota domain model

ALTER TABLE tenant_quotas ADD COLUMN IF NOT EXISTS max_cpu_cores INT DEFAULT 16;
ALTER TABLE tenant_quotas ADD COLUMN IF NOT EXISTS max_memory_gb INT DEFAULT 32;
ALTER TABLE tenant_quotas ADD COLUMN IF NOT EXISTS max_tasks_per_pipeline INT DEFAULT 50;
ALTER TABLE tenant_quotas ADD COLUMN IF NOT EXISTS max_runners INT DEFAULT 5;
ALTER TABLE tenant_quotas ADD COLUMN IF NOT EXISTS api_rate_limit BIGINT DEFAULT 1000;
ALTER TABLE tenant_quotas ADD COLUMN IF NOT EXISTS api_rate_limit_window_seconds INT DEFAULT 60;
ALTER TABLE tenant_quotas ADD COLUMN IF NOT EXISTS max_pipeline_runs_per_day BIGINT DEFAULT 1000;

-- Rollback:
-- ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS max_cpu_cores;
-- ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS max_memory_gb;
-- ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS max_tasks_per_pipeline;
-- ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS max_runners;
-- ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS api_rate_limit;
-- ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS api_rate_limit_window_seconds;
-- ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS max_pipeline_runs_per_day;
