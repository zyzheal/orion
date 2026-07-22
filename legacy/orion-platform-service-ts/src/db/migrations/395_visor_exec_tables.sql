-- Migration 395: Visor Exec Tables persistence
-- Stores batch command execution logs, script templates, cron jobs, and file upload tasks

-- ============================================
-- Command Execution Logs
-- ============================================
CREATE TABLE IF NOT EXISTS visor_command_logs (
  id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  command TEXT NOT NULL,
  host_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  host_count INTEGER NOT NULL DEFAULT 0,
  timeout INTEGER NOT NULL DEFAULT 30,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visor_command_logs_tenant ON visor_command_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_command_logs_created_at ON visor_command_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visor_command_logs_status ON visor_command_logs(status);

-- ============================================
-- Command Execution Log Details (per host)
-- ============================================
CREATE TABLE IF NOT EXISTS visor_command_log_details (
  id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  command_id VARCHAR(100) NOT NULL,
  hostname VARCHAR(500) NOT NULL,
  output TEXT DEFAULT '',
  error_output TEXT DEFAULT '',
  exit_code INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visor_command_log_details_command_id ON visor_command_log_details(command_id);
CREATE INDEX IF NOT EXISTS idx_visor_command_log_details_tenant ON visor_command_log_details(tenant_id);

-- ============================================
-- Script Templates
-- ============================================
CREATE TABLE IF NOT EXISTS visor_templates (
  id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name VARCHAR(200) NOT NULL,
  description TEXT DEFAULT '',
  content TEXT NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visor_templates_tenant ON visor_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_templates_updated_at ON visor_templates(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_visor_templates_category ON visor_templates(category);

-- ============================================
-- Cron Jobs
-- ============================================
CREATE TABLE IF NOT EXISTS visor_cron_jobs (
  id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name VARCHAR(200) NOT NULL,
  command TEXT NOT NULL,
  host_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  hostnames JSONB NOT NULL DEFAULT '[]'::jsonb,
  cron_expression VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visor_cron_jobs_tenant ON visor_cron_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_cron_jobs_enabled ON visor_cron_jobs(enabled);
CREATE INDEX IF NOT EXISTS idx_visor_cron_jobs_created_at ON visor_cron_jobs(created_at DESC);

-- ============================================
-- Cron Job Execution Logs
-- ============================================
CREATE TABLE IF NOT EXISTS visor_cron_job_logs (
  id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  job_id VARCHAR(100) NOT NULL,
  command_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visor_cron_job_logs_job_id ON visor_cron_job_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_visor_cron_job_logs_tenant ON visor_cron_job_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_cron_job_logs_created_at ON visor_cron_job_logs(created_at DESC);

-- ============================================
-- File Upload Tasks
-- ============================================
CREATE TABLE IF NOT EXISTS visor_upload_tasks (
  id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  host_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  hostnames JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_path TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visor_upload_tasks_tenant ON visor_upload_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_upload_tasks_created_at ON visor_upload_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visor_upload_tasks_status ON visor_upload_tasks(status);
