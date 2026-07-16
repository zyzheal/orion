-- Migration 042: Namespace Resource Pools

CREATE TABLE IF NOT EXISTS namespace_pools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  namespace       VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(50) NOT NULL,
  capacity        JSONB NOT NULL,
  used            JSONB NOT NULL DEFAULT '{"cpu": 0, "memory": 0}',
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_namespace_pools_tenant ON namespace_pools(tenant_id);
CREATE INDEX idx_namespace_pools_namespace ON namespace_pools(namespace);

-- Rollback:
-- DROP TABLE IF EXISTS namespace_pools;
