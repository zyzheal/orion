-- Migration 453: Create service_registry table
-- Phase 6 Service Governance: persistent storage for service registration

-- Service registry table
CREATE TABLE IF NOT EXISTS service_registry (
  id               VARCHAR(100) PRIMARY KEY,
  tenant_id        VARCHAR(100) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id       VARCHAR(100) NOT NULL,
  service_name     VARCHAR(255) NOT NULL,
  service_url      TEXT NOT NULL,
  protocol         VARCHAR(20) NOT NULL DEFAULT 'http',
  version          VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  status           VARCHAR(20) NOT NULL DEFAULT 'registered',
  health_status    VARCHAR(20) NOT NULL DEFAULT 'unknown',
  last_heartbeat_at TIMESTAMPTZ,
  metadata         JSONB NOT NULL DEFAULT '{}',
  registered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deregistered_at  TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, service_id)
);

-- Indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_service_registry_tenant ON service_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_registry_service_id ON service_registry(service_id);
CREATE INDEX IF NOT EXISTS idx_service_registry_status ON service_registry(status);
CREATE INDEX IF NOT EXISTS idx_service_registry_health ON service_registry(health_status);
CREATE INDEX IF NOT EXISTS idx_service_registry_updated ON service_registry(updated_at DESC);

-- Rollback:
-- DROP INDEX IF EXISTS idx_service_registry_updated;
-- DROP INDEX IF EXISTS idx_service_registry_health;
-- DROP INDEX IF EXISTS idx_service_registry_status;
-- DROP INDEX IF EXISTS idx_service_registry_service_id;
-- DROP INDEX IF EXISTS idx_service_registry_tenant;
-- DROP TABLE IF EXISTS service_registry;
