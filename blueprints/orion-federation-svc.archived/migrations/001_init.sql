-- 001: Federation Service Schema
-- 联邦集群管理、执行器、跨集群任务

-- 租户表（简化版，仅用于测试）
CREATE TABLE IF NOT EXISTS tenants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(200) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- federation_clusters 表（联邦集群注册）
CREATE TABLE IF NOT EXISTS federation_clusters (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(200) NOT NULL,
  endpoint          VARCHAR(500) NOT NULL,
  region            VARCHAR(100) NOT NULL,
  cloud_provider    VARCHAR(50) NOT NULL DEFAULT 'unknown',
  k8s_version       VARCHAR(50) NOT NULL DEFAULT 'unknown',
  status            VARCHAR(30) NOT NULL DEFAULT 'online', -- online, offline, maintenance, degraded
  capacity_cpu      INT NOT NULL DEFAULT 100,
  capacity_memory_mb INT NOT NULL DEFAULT 65536,
  load_cpu          INT NOT NULL DEFAULT 0,
  load_memory_mb    INT NOT NULL DEFAULT 0,
  last_heartbeat    TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fc_tenant ON federation_clusters(tenant_id);
CREATE INDEX idx_fc_status ON federation_clusters(status);
CREATE INDEX idx_fc_region ON federation_clusters(region);

-- federation_cluster_health 表（集群健康指标）
CREATE TABLE IF NOT EXISTS federation_cluster_health (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id            UUID NOT NULL,
  status                VARCHAR(30) NOT NULL DEFAULT 'unknown', -- healthy, unhealthy, degraded, unknown
  api_server_reachable  BOOLEAN NOT NULL DEFAULT false,
  api_server_latency_ms INT NOT NULL DEFAULT 0,
  node_count            INT NOT NULL DEFAULT 0,
  node_ready_count      INT NOT NULL DEFAULT 0,
  pod_count             INT NOT NULL DEFAULT 0,
  cpu_usage_pct         FLOAT NOT NULL DEFAULT 0,
  memory_usage_pct      FLOAT NOT NULL DEFAULT 0,
  disk_usage_pct        FLOAT NOT NULL DEFAULT 0,
  anomalies             JSONB NOT NULL DEFAULT '[]',
  checked_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fch_cluster ON federation_cluster_health(cluster_id);
CREATE INDEX idx_fch_checked ON federation_cluster_health(checked_at DESC);

-- federation_cluster_metrics 表（集群历史指标）
CREATE TABLE IF NOT EXISTS federation_cluster_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id        UUID NOT NULL,
  time_window       VARCHAR(20) NOT NULL DEFAULT '1h', -- 1h, 24h, 7d, 30d
  cpu_usage_avg     FLOAT NOT NULL DEFAULT 0,
  cpu_usage_max     FLOAT NOT NULL DEFAULT 0,
  memory_usage_avg  FLOAT NOT NULL DEFAULT 0,
  memory_usage_max  FLOAT NOT NULL DEFAULT 0,
  network_in_bytes  BIGINT NOT NULL DEFAULT 0,
  network_out_bytes BIGINT NOT NULL DEFAULT 0,
  pod_count_avg     FLOAT NOT NULL DEFAULT 0,
  pod_restart_count INT NOT NULL DEFAULT 0,
  error_count       INT NOT NULL DEFAULT 0,
  latency_p50_ms    FLOAT NOT NULL DEFAULT 0,
  latency_p99_ms    FLOAT NOT NULL DEFAULT 0,
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fcm_cluster ON federation_cluster_metrics(cluster_id);
CREATE INDEX idx_fcm_window ON federation_cluster_metrics(cluster_id, time_window);

-- federation_executors 表（执行器注册）
CREATE TABLE IF NOT EXISTS federation_executors (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id            UUID NOT NULL,
  name                  VARCHAR(200) NOT NULL,
  region                VARCHAR(100) NOT NULL,
  status                VARCHAR(30) NOT NULL DEFAULT 'online', -- online, offline, degraded
  cpu_capacity          INT NOT NULL DEFAULT 16,
  memory_capacity_mb    INT NOT NULL DEFAULT 32768,
  cpu_used              INT NOT NULL DEFAULT 0,
  memory_used_mb        INT NOT NULL DEFAULT 0,
  running_jobs          INT NOT NULL DEFAULT 0,
  max_concurrent_jobs   INT NOT NULL DEFAULT 10,
  last_heartbeat        TIMESTAMPTZ,
  registered_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  labels                JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_fe_cluster ON federation_executors(cluster_id);
CREATE INDEX idx_fe_status ON federation_executors(status);

-- federation_executor_health 表（执行器健康）
CREATE TABLE IF NOT EXISTS federation_executor_health (
  executor_id       UUID PRIMARY KEY,
  status            VARCHAR(30) NOT NULL DEFAULT 'healthy', -- healthy, unhealthy, degraded
  cpu_usage_pct     FLOAT NOT NULL DEFAULT 0,
  memory_usage_pct  FLOAT NOT NULL DEFAULT 0,
  running_jobs      INT NOT NULL DEFAULT 0,
  queue_depth       INT NOT NULL DEFAULT 0,
  last_heartbeat    TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_time_ms  INT NOT NULL DEFAULT 0,
  errors_last_hour  INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_feh_executor ON federation_executor_health(executor_id);

-- federation_jobs 表（跨集群任务）
CREATE TABLE IF NOT EXISTS federation_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(200) NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  job_type          VARCHAR(50) NOT NULL DEFAULT 'pipeline', -- pipeline, deployment, migration, sync
  source_cluster_id UUID,
  target_cluster_ids JSONB NOT NULL DEFAULT '[]',
  status            VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  priority          VARCHAR(20) NOT NULL DEFAULT 'normal', -- low, normal, high, critical
  spec              JSONB NOT NULL DEFAULT '{}',
  result            JSONB,
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fj_tenant ON federation_jobs(tenant_id);
CREATE INDEX idx_fj_status ON federation_jobs(status);
CREATE INDEX idx_fj_type ON federation_jobs(job_type);
CREATE INDEX idx_fj_source ON federation_jobs(source_cluster_id);
CREATE INDEX idx_fj_created ON federation_jobs(created_at DESC);

-- 插入默认租户（测试用）
INSERT INTO tenants (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'default-tenant') ON CONFLICT DO NOTHING;