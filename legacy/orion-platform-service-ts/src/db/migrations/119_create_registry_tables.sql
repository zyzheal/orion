-- Migration 119: Create nats_registry and k8s_provisioner tables
-- Creates tables for service instance registry and ephemeral namespace tracking

-- Service Instances (NATS Registry)
CREATE TABLE IF NOT EXISTS service_instances (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    health_url VARCHAR(500),
    metadata JSONB,
    registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_heartbeat TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_instances_name ON service_instances(name);
CREATE INDEX idx_service_instances_status ON service_instances(status);
CREATE INDEX idx_service_instances_heartbeat ON service_instances(last_heartbeat);

COMMENT ON TABLE service_instances IS 'NATS service registry - tracks service instances and their health';

-- K8s Namespaces (Ephemeral Environment Tracking)
CREATE TABLE IF NOT EXISTS k8s_namespaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace VARCHAR(255) NOT NULL,
    pr_id VARCHAR(100),
    branch_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    preview_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    destroyed_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_k8s_namespaces_namespace ON k8s_namespaces(namespace);
CREATE INDEX idx_k8s_namespaces_status ON k8s_namespaces(status);
CREATE INDEX idx_k8s_namespaces_pr ON k8s_namespaces(pr_id);

COMMENT ON TABLE k8s_namespaces IS 'Tracks ephemeral K8s namespaces for PR environments';

-- Federation Executors
CREATE TABLE IF NOT EXISTS federation_executors (
    id VARCHAR(255) PRIMARY KEY,
    cluster_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'online',
    cpu_capacity INTEGER NOT NULL DEFAULT 16,
    memory_capacity_mb INTEGER NOT NULL DEFAULT 32768,
    cpu_used INTEGER NOT NULL DEFAULT 0,
    memory_used_mb INTEGER NOT NULL DEFAULT 0,
    running_jobs INTEGER NOT NULL DEFAULT 0,
    max_concurrent_jobs INTEGER NOT NULL DEFAULT 10,
    last_heartbeat TIMESTAMP,
    registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    labels JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_federation_executors_cluster ON federation_executors(cluster_id);
CREATE INDEX idx_federation_executors_status ON federation_executors(status);

COMMENT ON TABLE federation_executors IS 'Federation job executors - tracks executor capacity and load';

-- Federation Executor Health
CREATE TABLE IF NOT EXISTS federation_executor_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    executor_id VARCHAR(255) NOT NULL REFERENCES federation_executors(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'healthy',
    cpu_usage_pct FLOAT NOT NULL DEFAULT 0,
    memory_usage_pct FLOAT NOT NULL DEFAULT 0,
    running_jobs INTEGER NOT NULL DEFAULT 0,
    queue_depth INTEGER NOT NULL DEFAULT 0,
    last_heartbeat TIMESTAMP NOT NULL,
    response_time_ms FLOAT NOT NULL DEFAULT 0,
    errors_last_hour INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_executor_health UNIQUE (executor_id)
);

CREATE INDEX idx_federation_executor_health_executor ON federation_executor_health(executor_id);

COMMENT ON TABLE federation_executor_health IS 'Latest health status for federation executors';
