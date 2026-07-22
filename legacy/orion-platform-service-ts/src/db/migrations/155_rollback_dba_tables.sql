-- Rollback Migration 155: DBA Service Tables
--
-- Removes all DBA-related tables and RLS policies

-- Drop RLS policies first
DROP POLICY IF EXISTS tenant_isolation_policy ON dba_audit_logs;
DROP POLICY IF EXISTS tenant_isolation_policy ON dba_user_permissions;
DROP POLICY IF EXISTS tenant_isolation_policy ON dba_sql_orders;
DROP POLICY IF EXISTS tenant_isolation_policy ON dba_audit_rules;
DROP POLICY IF EXISTS tenant_isolation_policy ON dba_data_sources;

-- Disable RLS
ALTER TABLE dba_audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE dba_user_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE dba_sql_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE dba_audit_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE dba_data_sources DISABLE ROW LEVEL SECURITY;

-- Drop tables
DROP TABLE IF EXISTS dba_audit_logs;
DROP TABLE IF EXISTS dba_user_permissions;
DROP TABLE IF EXISTS dba_sql_orders;
DROP TABLE IF EXISTS dba_audit_rules;
DROP TABLE IF EXISTS dba_data_sources;