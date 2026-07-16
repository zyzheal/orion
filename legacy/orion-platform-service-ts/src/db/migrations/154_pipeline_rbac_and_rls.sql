-- Migration 154: Pipeline RBAC Rules Table & RBAC Table RLS
--
-- 1. Creates the pipeline_rbac_rules table that was previously only referenced
--    in code (RBACRuleRepository) but had no database schema.
--
-- 2. Enables Row Level Security on RBAC-related tables for tenant isolation.

-- ============================================================
-- 1. Pipeline RBAC Rules Table
-- ============================================================

CREATE TABLE IF NOT EXISTS pipeline_rbac_rules (
  id          VARCHAR(100) PRIMARY KEY, -- composite: "{pipelineId}:{userId}"
  pipeline_id UUID NOT NULL,
  user_id     UUID NOT NULL,
  role        VARCHAR(50) NOT NULL CHECK (role IN (
    'pipeline.admin', 'pipeline.editor', 'pipeline.viewer', 'pipeline.approver'
  )),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, user_id)
);

CREATE INDEX idx_pipeline_rbac_rules_pipeline ON pipeline_rbac_rules(pipeline_id);
CREATE INDEX idx_pipeline_rbac_rules_user ON pipeline_rbac_rules(user_id);

COMMENT ON TABLE pipeline_rbac_rules IS 'Pipeline-level RBAC rules: maps users to roles per pipeline';

-- ============================================================
-- 2. RLS for RBAC Tables (Migration 002 tables)
-- ============================================================

-- Roles table RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON roles;
CREATE POLICY tenant_isolation_policy ON roles
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_roles_tenant_rls ON roles(tenant_id);

-- User-Role mapping RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON user_roles;
CREATE POLICY tenant_isolation_policy ON user_roles
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_rls ON user_roles(tenant_id);

-- Role-Permission mapping RLS (via role_id → roles → tenant_id)
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON role_permissions;
CREATE POLICY tenant_isolation_policy ON role_permissions
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
        AND r.tenant_id::text = current_setting('app.current_tenant_id')
    )
  );

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_rls ON role_permissions(role_id);

-- ============================================================
-- Rollback:
-- DROP TABLE IF EXISTS pipeline_rbac_rules;
-- DROP POLICY IF EXISTS tenant_isolation_policy ON roles;
-- DROP POLICY IF EXISTS tenant_isolation_policy ON user_roles;
-- DROP POLICY IF EXISTS tenant_isolation_policy ON role_permissions;
