-- Migration 343: DBA Service persistence tables
-- Replaces in-memory Map() storage with PostgreSQL

CREATE TABLE IF NOT EXISTS dba_sql_orders (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  database_name VARCHAR(255) NOT NULL,
  sql_text TEXT NOT NULL,
  comment TEXT,
  order_type VARCHAR(16) NOT NULL DEFAULT 'query',
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  result TEXT,
  approved_by VARCHAR(128),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dba_orders_tenant ON dba_sql_orders(tenant_id);
CREATE INDEX idx_dba_orders_status ON dba_sql_orders(tenant_id, status);
CREATE INDEX idx_dba_orders_created ON dba_sql_orders(tenant_id, created_at DESC);

ALTER TABLE dba_sql_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dba_sql_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dba_sql_orders
  USING (tenant_id = current_setting('app.current_tenant_id', true));


CREATE TABLE IF NOT EXISTS dba_data_sources (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(255) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL,
  database_name VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  password_encrypted TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'offline',
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dba_sources_tenant ON dba_data_sources(tenant_id);

ALTER TABLE dba_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE dba_data_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dba_data_sources
  USING (tenant_id = current_setting('app.current_tenant_id', true));


CREATE TABLE IF NOT EXISTS dba_audit_rules (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  pattern TEXT NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'warning',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dba_rules_tenant ON dba_audit_rules(tenant_id);

ALTER TABLE dba_audit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE dba_audit_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dba_audit_rules
  USING (tenant_id = current_setting('app.current_tenant_id', true));
