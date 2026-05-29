-- Middleware instances: Redis, Kafka, MySQL, ES, ZooKeeper, etc.
CREATE TABLE IF NOT EXISTS middleware_instances (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(64) NOT NULL,
    version     VARCHAR(128),
    host        VARCHAR(255) NOT NULL,
    port        INT NOT NULL DEFAULT 0,
    status      VARCHAR(32) NOT NULL DEFAULT 'active',
    config      JSONB DEFAULT '{}',
    labels      JSONB DEFAULT '{}',
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_middleware_instances_tenant ON middleware_instances(tenant_id);
CREATE INDEX idx_middleware_instances_type ON middleware_instances(tenant_id, type);

-- Backup records for middleware instances
CREATE TABLE IF NOT EXISTS backup_records (
    id           VARCHAR(64) PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL,
    instance_id  VARCHAR(64) NOT NULL,
    status       VARCHAR(32) NOT NULL DEFAULT 'running',
    size_bytes   BIGINT NOT NULL DEFAULT 0,
    location     TEXT,
    started_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);
CREATE INDEX idx_backup_records_tenant ON backup_records(tenant_id);
CREATE INDEX idx_backup_records_instance ON backup_records(tenant_id, instance_id);
