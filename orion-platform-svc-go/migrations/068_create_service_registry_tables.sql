-- Service Registry module tables

CREATE TABLE IF NOT EXISTS service_registries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    service_id VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    service_url VARCHAR(512) NOT NULL,
    protocol VARCHAR(50) DEFAULT 'http',
    version VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'registered',
    health_status VARCHAR(50) NOT NULL DEFAULT 'unknown',
    last_heartbeat_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deregistered_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_service_registries_tenant_id ON service_registries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_registries_service_name ON service_registries(service_name);
CREATE INDEX IF NOT EXISTS idx_service_registries_status ON service_registries(status);
CREATE INDEX IF NOT EXISTS idx_service_registries_health_status ON service_registries(health_status);
CREATE INDEX IF NOT EXISTS idx_service_registries_last_heartbeat_at ON service_registries(last_heartbeat_at DESC);
