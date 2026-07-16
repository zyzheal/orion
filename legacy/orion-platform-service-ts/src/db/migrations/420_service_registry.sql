-- Migration 420: Create service_registry table
-- Stores registered services with tenant isolation

CREATE TABLE IF NOT EXISTS service_registry (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  service_id VARCHAR(128) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  service_url TEXT NOT NULL,
  protocol VARCHAR(32) NOT NULL DEFAULT 'http' CHECK (protocol IN ('http', 'grpc', 'tcp', 'custom')),
  version VARCHAR(64) DEFAULT '1.0.0',
  status VARCHAR(32) NOT NULL DEFAULT 'registered' CHECK (status IN ('registering', 'registered', 'deregistering', 'deregistered')),
  health_status VARCHAR(32) NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'unhealthy', 'degraded', 'unknown')),
  last_heartbeat_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deregistered_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_service_registry UNIQUE (tenant_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_service_registry_tenant_id
  ON service_registry (tenant_id);

CREATE INDEX IF NOT EXISTS idx_service_registry_service_id
  ON service_registry (service_id);

CREATE INDEX IF NOT EXISTS idx_service_registry_status
  ON service_registry (status);

CREATE INDEX IF NOT EXISTS idx_service_registry_health_status
  ON service_registry (health_status);

CREATE INDEX IF NOT EXISTS idx_service_registry_tenant_status
  ON service_registry (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_service_registry_tenant_health
  ON service_registry (tenant_id, health_status);

CREATE INDEX IF NOT EXISTS idx_service_registry_updated_at
  ON service_registry (updated_at DESC);
