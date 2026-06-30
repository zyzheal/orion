-- Migration 382: Service Permissions PostgreSQL persistence
-- 服务级权限表：支持租户隔离、服务维度的权限管理

CREATE TABLE IF NOT EXISTS service_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name VARCHAR(200) NOT NULL,
  permission_key VARCHAR(200) NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, service_name, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_svc_perm_tenant ON service_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_svc_perm_service ON service_permissions(service_name);
CREATE INDEX IF NOT EXISTS idx_svc_perm_enabled ON service_permissions(enabled) WHERE enabled = true;
