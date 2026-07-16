-- Migration: 187_create_dba_tables.sql
-- Purpose: Create tables for DBA (Database Administration) module
--   SQL orders, data sources, audit rules

-- Data Sources
CREATE TABLE IF NOT EXISTS dba_data_sources (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(50) NOT NULL,  -- mysql, postgresql, redis, mongodb
    host        VARCHAR(255) NOT NULL,
    port        INTEGER NOT NULL,
    database_name VARCHAR(255) NOT NULL,
    username    VARCHAR(255),
    password    VARCHAR(255),  -- should be encrypted in production
    status      VARCHAR(20) DEFAULT 'offline',  -- online, offline, error
    last_checked TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_dba_ds_type CHECK (type IN ('mysql', 'postgresql', 'redis', 'mongodb')),
    CONSTRAINT chk_dba_ds_status CHECK (status IN ('online', 'offline', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_dba_ds_tenant ON dba_data_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dba_ds_status ON dba_data_sources(status);

-- SQL Orders
CREATE TABLE IF NOT EXISTS dba_sql_orders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    user_id     VARCHAR(255) NOT NULL,
    database    VARCHAR(255) NOT NULL,
    sql         TEXT NOT NULL,
    comment     TEXT,
    type        VARCHAR(20) DEFAULT 'query',  -- query, insert, update, delete, ddl
    status      VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected, executing, completed, failed
    result      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    CONSTRAINT chk_dba_order_type CHECK (type IN ('query', 'insert', 'update', 'delete', 'ddl')),
    CONSTRAINT chk_dba_order_status CHECK (status IN ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_dba_orders_tenant ON dba_sql_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dba_orders_status ON dba_sql_orders(status);
CREATE INDEX IF NOT EXISTS idx_dba_orders_user ON dba_sql_orders(user_id);

-- Audit Rules
CREATE TABLE IF NOT EXISTS dba_audit_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name        VARCHAR(255) NOT NULL,
    pattern     TEXT NOT NULL,
    severity    VARCHAR(20) DEFAULT 'warning',  -- info, warning, error
    enabled     BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_dba_rule_severity CHECK (severity IN ('info', 'warning', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_dba_rules_tenant ON dba_audit_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dba_rules_enabled ON dba_audit_rules(enabled);
