-- Rollback Migration 154: Pipeline RBAC Rules Table & RBAC Table RLS

DROP TABLE IF EXISTS pipeline_rbac_rules;

DROP POLICY IF EXISTS tenant_isolation_policy ON roles;
ALTER TABLE roles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON user_roles;
ALTER TABLE user_roles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON role_permissions;
ALTER TABLE role_permissions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;
