-- Migration 001: Inception Service Tables
-- SQL audit history, blacklist, configs, and report tracking

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- SQL Audit History
-- Stores audit results from Inception engine
CREATE TABLE IF NOT EXISTS sql_audit_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(100) NOT NULL,
  db_name         VARCHAR(100) NOT NULL,
  sql_statement   TEXT NOT NULL,
  operation_type  VARCHAR(20) NOT NULL DEFAULT 'audit',
  dry_run         BOOLEAN DEFAULT false,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  errors          JSONB DEFAULT '[]',
  warnings        JSONB DEFAULT '[]',
  affected_rows   INTEGER,
  exec_time_ms    INTEGER,
  audited_by      VARCHAR(100),
  request_id      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sql_audit_history_tenant ON sql_audit_history(tenant_id);
CREATE INDEX idx_sql_audit_history_db ON sql_audit_history(db_name);
CREATE INDEX idx_sql_audit_history_status ON sql_audit_history(status);
CREATE INDEX idx_sql_audit_history_created ON sql_audit_history(created_at DESC);

-- SQL Execution Blacklist
-- Tracks dangerous SQL patterns that should be blocked
CREATE TABLE IF NOT EXISTS sql_blacklist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(100),
  pattern         VARCHAR(500) NOT NULL,
  description     VARCHAR(500),
  severity        VARCHAR(20) NOT NULL DEFAULT 'high',
  enabled         BOOLEAN DEFAULT true,
  created_by      VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, pattern)
);

CREATE INDEX idx_sql_blacklist_pattern ON sql_blacklist(pattern);
CREATE INDEX idx_sql_blacklist_enabled ON sql_blacklist(enabled);

-- Inception Connection Config
-- Stores Inception server configurations per tenant
CREATE TABLE IF NOT EXISTS inception_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(100) NOT NULL UNIQUE,
  host            VARCHAR(255) NOT NULL,
  port            INTEGER NOT NULL DEFAULT 6669,
  user            VARCHAR(100) NOT NULL,
  encrypted_password VARCHAR(500),
  default_db      VARCHAR(100),
  timeout_ms      INTEGER DEFAULT 30000,
  enabled         BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inception_configs_tenant ON inception_configs(tenant_id);

-- Audit Report Export
-- Stores exported audit reports
CREATE TABLE IF NOT EXISTS audit_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(100) NOT NULL,
  report_name     VARCHAR(255) NOT NULL,
  format          VARCHAR(20) NOT NULL DEFAULT 'json',
  filters         JSONB DEFAULT '{}',
  file_path       VARCHAR(500),
  status          VARCHAR(20) NOT NULL DEFAULT 'generating',
  generated_by    VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_audit_reports_tenant ON audit_reports(tenant_id);
CREATE INDEX idx_audit_reports_status ON audit_reports(status);
CREATE INDEX idx_audit_reports_created ON audit_reports(created_at DESC);
