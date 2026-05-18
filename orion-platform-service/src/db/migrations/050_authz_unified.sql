-- Migration 050: RBAC+ABAC Unified Permission System
--
-- Creates unified permission tables combining RBAC and ABAC models:
-- 1. abac_policies       - ABAC attribute-based access control policies
-- 2. project_members     - Project-level membership and role assignment
-- 3. resource_tags       - Resource tagging for fine-grained ABAC conditions
-- 4. permission_audit_logs - Permission decision audit trail
-- 5. role_inheritance    - Role inheritance hierarchy (RBAC extension)

-- ============================================================
-- 1. ABAC Policies Table
-- ============================================================

CREATE TABLE IF NOT EXISTS abac_policies (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID REFERENCES tenants(id),
  name                     VARCHAR(200) NOT NULL,
  description              TEXT,
  effect                   VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
  resource_type            VARCHAR(100) NOT NULL,
  action_type              VARCHAR(50) NOT NULL,
  subject_conditions       JSONB NOT NULL DEFAULT '{}',
  resource_conditions      JSONB NOT NULL DEFAULT '{}',
  environment_conditions   JSONB NOT NULL DEFAULT '{}',
  priority                 INT NOT NULL DEFAULT 0,
  enabled                  BOOLEAN NOT NULL DEFAULT true,
  created_by               UUID REFERENCES users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abac_policies_resource ON abac_policies(resource_type, action_type);
CREATE INDEX IF NOT EXISTS idx_abac_policies_tenant ON abac_policies(tenant_id);

COMMENT ON TABLE abac_policies IS 'ABAC attribute-based access control policies';
COMMENT ON COLUMN abac_policies.subject_conditions IS 'JSONB conditions on subject attributes (department, role, clearance, etc.)';
COMMENT ON COLUMN abac_policies.resource_conditions IS 'JSONB conditions on resource attributes (tags, owner, sensitivity, etc.)';
COMMENT ON COLUMN abac_policies.environment_conditions IS 'JSONB conditions on environment (time, IP, location, etc.)';

-- ============================================================
-- 2. Project Members Table
-- ============================================================

CREATE TABLE IF NOT EXISTS project_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(50) NOT NULL,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

COMMENT ON TABLE project_members IS 'Project-level membership mapping with role assignment';

-- ============================================================
-- 3. Resource Tags Table
-- ============================================================

CREATE TABLE IF NOT EXISTS resource_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type   VARCHAR(100) NOT NULL,
  resource_id     UUID NOT NULL,
  tag             VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(resource_type, resource_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_resource_tags_lookup ON resource_tags(resource_type, resource_id);

COMMENT ON TABLE resource_tags IS 'Resource tags for ABAC condition matching and resource classification';

-- ============================================================
-- 4. Permission Audit Logs Table
-- ============================================================

CREATE TABLE IF NOT EXISTS permission_audit_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID REFERENCES tenants(id),
  user_id            UUID REFERENCES users(id),
  resource_type      VARCHAR(100),
  resource_id        UUID,
  action             VARCHAR(50),
  decision           VARCHAR(10) CHECK (decision IN ('allow', 'deny')),
  decision_source    VARCHAR(50),
  reason             TEXT,
  evaluated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_user ON permission_audit_logs(user_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_permission_audit_denied ON permission_audit_logs(decision, evaluated_at DESC)
  WHERE decision = 'deny';

COMMENT ON TABLE permission_audit_logs IS 'Audit trail for all permission evaluation decisions';
COMMENT ON COLUMN permission_audit_logs.decision_source IS 'Source of decision: RBAC, ABAC, project_member, admin_override, etc.';

-- ============================================================
-- 5. Role Inheritance Table
-- ============================================================

CREATE TABLE IF NOT EXISTS role_inheritance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_role     VARCHAR(100) NOT NULL,
  child_role      VARCHAR(100) NOT NULL,
  UNIQUE(parent_role, child_role)
);

COMMENT ON TABLE role_inheritance IS 'Role inheritance hierarchy: child_role inherits all permissions of parent_role';

-- ============================================================
-- Rollback:
-- DROP TABLE IF EXISTS abac_policies;
-- DROP TABLE IF EXISTS project_members;
-- DROP TABLE IF EXISTS resource_tags;
-- DROP TABLE IF EXISTS permission_audit_logs;
-- DROP TABLE IF EXISTS role_inheritance;
