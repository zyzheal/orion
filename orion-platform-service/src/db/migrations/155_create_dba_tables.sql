-- Migration 155: DBA Service Tables
--
-- DBA Service provides SQL auditing and data source management.
-- This migration creates tables for storing DBA configuration and audit metadata.
--
-- The service proxies to Yearning backend for actual SQL order management.

-- ============================================================
-- 1. DBA Data Sources (metadata sync from Yearning)
-- ============================================================

CREATE TABLE IF NOT EXISTS dba_data_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yearning_id     VARCHAR(100) UNIQUE, -- ID from Yearning backend
  name            VARCHAR(255) NOT NULL,
  host            VARCHAR(500) NOT NULL,
  port            INTEGER NOT NULL DEFAULT 3306,
  db_type         VARCHAR(50) NOT NULL CHECK (db_type IN ('mysql', 'postgresql', 'oracle', 'mssql')),
  database        VARCHAR(255) NOT NULL,
  username        VARCHAR(255),
  tenant_id       UUID NOT NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  last_checked    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dba_data_sources_tenant ON dba_data_sources(tenant_id);
CREATE INDEX idx_dba_data_sources_status ON dba_data_sources(status);
CREATE INDEX idx_dba_data_sources_yearning ON dba_data_sources(yearning_id);

COMMENT ON TABLE dba_data_sources IS 'DBA data sources registry (sync from Yearning)';

-- ============================================================
-- 2. DBA Audit Rules (metadata sync from Yearning)
-- ============================================================

CREATE TABLE IF NOT EXISTS dba_audit_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yearning_id     VARCHAR(100) UNIQUE,
  name            VARCHAR(255) NOT NULL,
  rule_type       VARCHAR(50) NOT NULL, -- e.g., 'syntax', 'performance', 'security'
  pattern         TEXT,
  severity        VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'error', 'warning', 'info')),
  enabled         BOOLEAN NOT NULL DEFAULT true,
  tenant_id       UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dba_audit_rules_tenant ON dba_audit_rules(tenant_id);
CREATE INDEX idx_dba_audit_rules_type ON dba_audit_rules(rule_type);

COMMENT ON TABLE dba_audit_rules IS 'DBA audit rules (sync from Yearning)';

-- ============================================================
-- 3. DBA SQL Orders (cached metadata)
-- ============================================================

CREATE TABLE IF NOT EXISTS dba_sql_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yearning_id     VARCHAR(100) UNIQUE,
  title           VARCHAR(500) NOT NULL,
  sql_content     TEXT NOT NULL,
  data_source_id  UUID REFERENCES dba_data_sources(id) ON DELETE SET NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'executing', 'executed', 'failed'
  )),
  requester_id    UUID NOT NULL,
  approver_id     UUID,
  executor_id     UUID,
  tenant_id       UUID NOT NULL,
  execute_at      TIMESTAMPTZ,
  executed_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dba_sql_orders_tenant ON dba_sql_orders(tenant_id);
CREATE INDEX idx_dba_sql_orders_status ON dba_sql_orders(status);
CREATE INDEX idx_dba_sql_orders_requester ON dba_sql_orders(requester_id);
CREATE INDEX idx_dba_sql_orders_datasource ON dba_sql_orders(data_source_id);

COMMENT ON TABLE dba_sql_orders IS 'DBA SQL order metadata (cached from Yearning)';

-- ============================================================
-- 4. DBA User Permissions
-- ============================================================

CREATE TABLE IF NOT EXISTS dba_user_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  tenant_id       UUID NOT NULL,
  can_execute     BOOLEAN NOT NULL DEFAULT false,
  can_approve     BOOLEAN NOT NULL DEFAULT false,
  can_manage_datasource BOOLEAN NOT NULL DEFAULT false,
  can_manage_rules BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_dba_user_permissions_user ON dba_user_permissions(user_id);
CREATE INDEX idx_dba_user_permissions_tenant ON dba_user_permissions(tenant_id);

COMMENT ON TABLE dba_user_permissions IS 'DBA-specific user permissions';

-- ============================================================
-- 5. DBA Audit Logs
-- ============================================================

CREATE TABLE IF NOT EXISTS dba_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES dba_sql_orders(id) ON DELETE SET NULL,
  action          VARCHAR(50) NOT NULL, -- 'create', 'approve', 'reject', 'execute', 'query'
  user_id         UUID NOT NULL,
  tenant_id       UUID NOT NULL,
  details         JSONB,
  ip_address      VARCHAR(50),
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dba_audit_logs_tenant ON dba_audit_logs(tenant_id);
CREATE INDEX idx_dba_audit_logs_order ON dba_audit_logs(order_id);
CREATE INDEX idx_dba_audit_logs_user ON dba_audit_logs(user_id);
CREATE INDEX idx_dba_audit_logs_created ON dba_audit_logs(created_at);

COMMENT ON TABLE dba_audit_logs IS 'DBA operation audit trail';

-- ============================================================
-- 6. Enable RLS for tenant isolation
-- ============================================================

ALTER TABLE dba_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE dba_audit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE dba_sql_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dba_user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dba_audit_logs ENABLE ROW LEVEL SECURITY;

-- Data Sources RLS
DROP POLICY IF EXISTS tenant_isolation_policy ON dba_data_sources;
CREATE POLICY tenant_isolation_policy ON dba_data_sources
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

-- Audit Rules RLS
DROP POLICY IF EXISTS tenant_isolation_policy ON dba_audit_rules;
CREATE POLICY tenant_isolation_policy ON dba_audit_rules
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

-- SQL Orders RLS
DROP POLICY IF EXISTS tenant_isolation_policy ON dba_sql_orders;
CREATE POLICY tenant_isolation_policy ON dba_sql_orders
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

-- User Permissions RLS
DROP POLICY IF EXISTS tenant_isolation_policy ON dba_user_permissions;
CREATE POLICY tenant_isolation_policy ON dba_user_permissions
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

-- Audit Logs RLS (read-only for audit)
DROP POLICY IF EXISTS tenant_isolation_policy ON dba_audit_logs;
CREATE POLICY tenant_isolation_policy ON dba_audit_logs
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

-- ============================================================
-- Rollback:
-- DROP TABLE IF EXISTS dba_audit_logs;
-- DROP TABLE IF EXISTS dba_user_permissions;
-- DROP TABLE IF EXISTS dba_sql_orders;
-- DROP TABLE IF EXISTS dba_audit_rules;
-- DROP TABLE IF EXISTS dba_data_sources;