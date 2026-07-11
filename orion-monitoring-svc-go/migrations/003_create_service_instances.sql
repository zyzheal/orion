-- 003_create_service_instances.sql
-- Service instances table for managing service lifecycle (start/stop/health)

CREATE TABLE IF NOT EXISTS service_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'unknown',  -- running, stopped, starting, stopping, unknown
    health VARCHAR(50) NOT NULL DEFAULT 'unknown',  -- healthy, degraded, unhealthy, unknown
    port INTEGER DEFAULT 0,
    uptime_sec BIGINT DEFAULT 0,
    last_seen TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Indexes for service instance queries
CREATE INDEX IF NOT EXISTS idx_service_instances_tenant ON service_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_instances_status ON service_instances(status);
