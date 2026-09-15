-- 599_create_federation_missing_tables.sql
-- federation 模块 7 张表无 CREATE TABLE。
-- executor_health 不用 id/tenant_id，用 executor_id 作为主键。
-- 回滚见 599_create_federation_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS federated_clusters (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    peer_url   TEXT NOT NULL DEFAULT '',
    protocol   TEXT NOT NULL DEFAULT 'http',
    status     TEXT NOT NULL DEFAULT 'active',
    config     JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_federated_clusters_tenant ON federated_clusters(tenant_id);

CREATE TABLE IF NOT EXISTS executors (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    cluster_id        UUID,
    name              TEXT NOT NULL DEFAULT '',
    region            TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'active',
    cpu_capacity      INTEGER NOT NULL DEFAULT 0,
    memory_capacity_mb INTEGER NOT NULL DEFAULT 0,
    cpu_used          INTEGER NOT NULL DEFAULT 0,
    memory_used_mb    INTEGER NOT NULL DEFAULT 0,
    running_jobs      INTEGER NOT NULL DEFAULT 0,
    max_concurrent_jobs INTEGER NOT NULL DEFAULT 10,
    last_heartbeat    TIMESTAMPTZ,
    registered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    labels            JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_executors_tenant ON executors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_executors_cluster ON executors(cluster_id);

CREATE TABLE IF NOT EXISTS executor_health (
    executor_id        TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'healthy',
    cpu_usage_pct      DECIMAL(5,2) NOT NULL DEFAULT 0,
    memory_usage_pct   DECIMAL(5,2) NOT NULL DEFAULT 0,
    running_jobs       INTEGER NOT NULL DEFAULT 0,
    queue_depth        INTEGER NOT NULL DEFAULT 0,
    last_heartbeat     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_time_ms   INTEGER NOT NULL DEFAULT 0,
    errors_last_hour   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (executor_id)
);

CREATE TABLE IF NOT EXISTS cross_cluster_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    name             TEXT NOT NULL DEFAULT '',
    spec             JSONB NOT NULL DEFAULT '{}',
    target_clusters  JSONB NOT NULL DEFAULT '[]',
    status           TEXT NOT NULL DEFAULT 'pending',
    scheduled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cross_cluster_jobs_tenant ON cross_cluster_jobs(tenant_id);

CREATE TABLE IF NOT EXISTS resource_pools (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    cluster_id  UUID,
    cpu         INTEGER NOT NULL DEFAULT 0,
    memory      INTEGER NOT NULL DEFAULT 0,
    used_cpu    INTEGER NOT NULL DEFAULT 0,
    used_memory INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resource_pools_tenant ON resource_pools(tenant_id);

CREATE TABLE IF NOT EXISTS scheduling_policies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    strategy    TEXT NOT NULL DEFAULT 'round-robin',
    rules       JSONB DEFAULT '[]',
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduling_policies_tenant ON scheduling_policies(tenant_id);

CREATE TABLE IF NOT EXISTS federation_configs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    clusters    JSONB NOT NULL DEFAULT '[]',
    strategy    TEXT NOT NULL DEFAULT 'round-robin',
    status      TEXT NOT NULL DEFAULT 'active',
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_federation_configs_tenant ON federation_configs(tenant_id);
