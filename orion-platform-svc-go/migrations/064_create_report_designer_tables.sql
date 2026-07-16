-- Migration 001: Report Designer Tables
-- Report definitions, datasources, schedules, and execution history

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Report Definitions
-- Stores report layouts, components, and configuration
CREATE TABLE IF NOT EXISTS report_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(100),
  layout          JSONB,
  components      JSONB,
  datasource_bindings JSONB DEFAULT '{}',
  template_id     VARCHAR(100),
  status          VARCHAR(50) NOT NULL DEFAULT 'draft',
  enabled         BOOLEAN DEFAULT true,
  created_by      VARCHAR(100) NOT NULL DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_definitions_tenant ON report_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_definitions_category ON report_definitions(category);
CREATE INDEX IF NOT EXISTS idx_report_definitions_status ON report_definitions(status);
CREATE INDEX IF NOT EXISTS idx_report_definitions_enabled ON report_definitions(enabled);

-- Report Datasources
-- Data source configurations for reports
CREATE TABLE IF NOT EXISTS report_datasources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  report_id       UUID,
  name            VARCHAR(255) NOT NULL,
  datasource_type VARCHAR(100) NOT NULL,
  config          JSONB NOT NULL,
  refresh_interval INTEGER,
  status          VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_datasources_tenant ON report_datasources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_datasources_report_id ON report_datasources(report_id);
CREATE INDEX IF NOT EXISTS idx_report_datasources_status ON report_datasources(status);

-- Report Schedules
-- Cron-based scheduling for report generation
CREATE TABLE IF NOT EXISTS report_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  report_id       UUID NOT NULL,
  cron_expr       VARCHAR(100) NOT NULL,
  timezone        VARCHAR(50) DEFAULT 'UTC',
  export_format   VARCHAR(20) NOT NULL DEFAULT 'pdf',
  recipients      JSONB DEFAULT '[]',
  enabled         BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_schedules_tenant ON report_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_report_id ON report_schedules(report_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_enabled ON report_schedules(enabled);

-- Report Executions
-- Execution history for reports
CREATE TABLE IF NOT EXISTS report_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  report_id       UUID NOT NULL,
  schedule_id     UUID,
  status          VARCHAR(50) NOT NULL DEFAULT 'running',
  output_path     VARCHAR(500),
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_report_executions_tenant ON report_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_report_id ON report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_schedule_id ON report_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status);
