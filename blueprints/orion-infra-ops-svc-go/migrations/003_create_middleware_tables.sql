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

-- Middleware metrics (CPU, memory, connections, latency, etc.)
CREATE TABLE IF NOT EXISTS middleware_metrics (
    id            VARCHAR(64) PRIMARY KEY,
    tenant_id     VARCHAR(64) NOT NULL,
    middleware_id VARCHAR(64) NOT NULL,
    metric_name   VARCHAR(255) NOT NULL,
    value         DOUBLE PRECISION NOT NULL DEFAULT 0,
    unit          VARCHAR(64) NOT NULL DEFAULT '',
    timestamp     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_middleware_metrics_tenant ON middleware_metrics(tenant_id);
CREATE INDEX idx_middleware_metrics_middleware ON middleware_metrics(tenant_id, middleware_id);
CREATE INDEX idx_middleware_metrics_name ON middleware_metrics(tenant_id, metric_name);

-- Connection pool snapshots
CREATE TABLE IF NOT EXISTS connection_pools (
    id             VARCHAR(64) PRIMARY KEY,
    tenant_id      VARCHAR(64) NOT NULL,
    middleware_id  VARCHAR(64) NOT NULL,
    pool_name      VARCHAR(255) NOT NULL,
    active         INT NOT NULL DEFAULT 0,
    idle           INT NOT NULL DEFAULT 0,
    max_conn       INT NOT NULL DEFAULT 0,
    waiting        INT NOT NULL DEFAULT 0,
    total_created  BIGINT NOT NULL DEFAULT 0,
    total_closed   BIGINT NOT NULL DEFAULT 0,
    timestamp      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_connection_pools_tenant ON connection_pools(tenant_id);
CREATE INDEX idx_connection_pools_middleware ON connection_pools(tenant_id, middleware_id);

-- Message queue stats snapshots
CREATE TABLE IF NOT EXISTS message_queue_stats (
    id                   VARCHAR(64) PRIMARY KEY,
    tenant_id            VARCHAR(64) NOT NULL,
    middleware_id        VARCHAR(64) NOT NULL,
    queue_name           VARCHAR(255) NOT NULL,
    message_count        BIGINT NOT NULL DEFAULT 0,
    consumer_count       INT NOT NULL DEFAULT 0,
    messages_per_second  DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg_latency_ms       DOUBLE PRECISION NOT NULL DEFAULT 0,
    dead_letter_count    BIGINT NOT NULL DEFAULT 0,
    timestamp            TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mq_stats_tenant ON message_queue_stats(tenant_id);
CREATE INDEX idx_mq_stats_middleware ON message_queue_stats(tenant_id, middleware_id);

-- Middleware alerts
CREATE TABLE IF NOT EXISTS middleware_alerts (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    middleware_id   VARCHAR(64) NOT NULL,
    middleware_name VARCHAR(255) NOT NULL DEFAULT '',
    alert_type      VARCHAR(64) NOT NULL,
    severity        VARCHAR(32) NOT NULL,
    message         TEXT NOT NULL DEFAULT '',
    value           DOUBLE PRECISION NOT NULL DEFAULT 0,
    threshold       DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_middleware_alerts_tenant ON middleware_alerts(tenant_id);
CREATE INDEX idx_middleware_alerts_severity ON middleware_alerts(tenant_id, severity);
