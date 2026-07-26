-- Migration 001: Inception Service Core Tables
-- Creates all core tables for SQL audit results, audit logs, and Inception service status tracking
-- Version: 1.0.0

-- ==================== SQL Audit Records ====================
CREATE TABLE IF NOT EXISTS sql_audit_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  database_name     VARCHAR(255) NOT NULL,
  sql_statement     TEXT NOT NULL,
  audit_success     BOOLEAN NOT NULL DEFAULT false,
  errors            JSONB DEFAULT '[]',
  warnings          JSONB DEFAULT '[]',
  affected_rows     INTEGER,
  exec_time_ms      INTEGER,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  submitted_by      VARCHAR(255) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sql_audit_records_tenant ON sql_audit_records(tenant_id);
CREATE INDEX idx_sql_audit_records_database ON sql_audit_records(database_name);
CREATE INDEX idx_sql_audit_records_success ON sql_audit_records(audit_success);
CREATE INDEX idx_sql_audit_records_status ON sql_audit_records(status);
CREATE INDEX idx_sql_audit_records_created ON sql_audit_records(created_at);

-- ==================== Inception Instances ====================
CREATE TABLE IF NOT EXISTS inception_instances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  host              VARCHAR(255) NOT NULL,
  port              INTEGER NOT NULL,
  connected         BOOLEAN NOT NULL DEFAULT false,
  latency_ms        INTEGER,
  last_check_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inception_instances_connected ON inception_instances(connected);

-- ==================== SQL Audit Rules ====================
CREATE TABLE IF NOT EXISTS sql_audit_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  rule_config       JSONB NOT NULL DEFAULT '{}',
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sql_audit_rules_tenant ON sql_audit_rules(tenant_id);
CREATE INDEX idx_sql_audit_rules_enabled ON sql_audit_rules(enabled);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS inception_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO inception_schema_migrations (version, description)
VALUES ('001', 'Initial inception service tables: sql_audit_records, inception_instances, sql_audit_rules');
