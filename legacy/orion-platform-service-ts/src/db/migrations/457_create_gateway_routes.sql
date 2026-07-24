-- Migration 457: Create gateway_routes table
-- Phase 6 Service Governance: persistent storage for API gateway route configuration

CREATE TABLE IF NOT EXISTS gateway_routes (
  id            VARCHAR(100) PRIMARY KEY,
  tenant_id     VARCHAR(100) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  path          TEXT NOT NULL,
  methods       JSONB NOT NULL DEFAULT '[]',
  upstream_url  TEXT,
  plugins       JSONB NOT NULL DEFAULT '{}',
  enabled       BOOLEAN NOT NULL DEFAULT true,
  priority      INTEGER NOT NULL DEFAULT 0,
  middleware    JSONB NOT NULL DEFAULT '[]',
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_by    VARCHAR(100),
  updated_by    VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gateway_routes_tenant ON gateway_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gateway_routes_enabled ON gateway_routes(enabled);
CREATE INDEX IF NOT EXISTS idx_gateway_routes_path ON gateway_routes(path);
CREATE INDEX IF NOT EXISTS idx_gateway_routes_priority ON gateway_routes(priority DESC);
CREATE INDEX IF NOT EXISTS idx_gateway_routes_created_at ON gateway_routes(created_at DESC);

-- Rollback:
-- DROP INDEX IF EXISTS idx_gateway_routes_created_at;
-- DROP INDEX IF EXISTS idx_gateway_routes_priority;
-- DROP INDEX IF EXISTS idx_gateway_routes_path;
-- DROP INDEX IF EXISTS idx_gateway_routes_enabled;
-- DROP INDEX IF EXISTS idx_gateway_routes_tenant;
-- DROP TABLE IF EXISTS gateway_routes;
