-- Migration 001: DBA Service Core Tables
-- Creates all core tables for SQL orders, data sources, audit rules, and user permissions
-- Version: 1.0.0

-- ==================== Data Sources ====================
CREATE TABLE IF NOT EXISTS data_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  host            VARCHAR(255) NOT NULL,
  port            INTEGER NOT NULL,
  database        VARCHAR(255) NOT NULL,
  type            VARCHAR(50) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  last_checked    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_sources_type ON data_sources(type);
CREATE INDEX idx_data_sources_status ON data_sources(status);
CREATE INDEX idx_data_sources_name ON data_sources(name);

-- ==================== SQL Orders ====================
CREATE TABLE IF NOT EXISTS sql_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  source_id       UUID NOT NULL REFERENCES data_sources(id),
  sql             TEXT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  submitted_by    VARCHAR(255) NOT NULL,
  approved_by     VARCHAR(255),
  executed_by     VARCHAR(255),
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at     TIMESTAMPTZ,
  executed_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sql_orders_tenant ON sql_orders(tenant_id);
CREATE INDEX idx_sql_orders_source ON sql_orders(source_id);
CREATE INDEX idx_sql_orders_status ON sql_orders(status);
CREATE INDEX idx_sql_orders_submitted_by ON sql_orders(submitted_by);
CREATE INDEX idx_sql_orders_submitted_at ON sql_orders(submitted_at);

-- ==================== Audit Rules ====================
CREATE TABLE IF NOT EXISTS audit_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  rules           JSONB NOT NULL DEFAULT '{}',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_rules_enabled ON audit_rules(enabled);
CREATE INDEX idx_audit_rules_name ON audit_rules(name);

-- ==================== User Permissions ====================
CREATE TABLE IF NOT EXISTS user_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR(255) NOT NULL,
  tenant_id       UUID NOT NULL,
  data_sources    JSONB NOT NULL DEFAULT '[]',
  roles           JSONB NOT NULL DEFAULT '[]',
  can_query       BOOLEAN NOT NULL DEFAULT false,
  can_execute     BOOLEAN NOT NULL DEFAULT false,
  can_approve     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_user_permissions_tenant ON user_permissions(tenant_id);
CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS dba_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO dba_schema_migrations (version, description)
VALUES ('001', 'Initial DBA service tables: data_sources, sql_orders, audit_rules, user_permissions');
