-- 101: Federation
-- 联邦集群、集群健康、跨集群任务

-- federation_clusters 表（联邦集群注册）
CREATE TABLE IF NOT EXISTS federation_clusters (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cluster_name      VARCHAR(200) NOT NULL,
  cluster_type      VARCHAR(50) NOT NULL DEFAULT 'kubernetes', -- kubernetes, nomad, ecs, aks, gke
  region            VARCHAR(100) NOT NULL,
  zone              VARCHAR(100),
  api_endpoint      VARCHAR(500) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'registering', -- registering, active, degraded, offline
  capacity          JSONB NOT NULL DEFAULT '{}',
  labels            JSONB NOT NULL DEFAULT '{}',
  registered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat    TIMESTAMPTZ,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_federation_clusters_tenant ON federation_clusters(tenant_id);
CREATE INDEX idx_federation_clusters_status ON federation_clusters(status);
CREATE INDEX idx_federation_clusters_region ON federation_clusters(region);
CREATE INDEX idx_federation_clusters_name ON federation_clusters(cluster_name);

-- cluster_health 表（集群健康指标）
CREATE TABLE IF NOT EXISTS cluster_health (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cluster_id        UUID NOT NULL REFERENCES federation_clusters(id) ON DELETE CASCADE,
  cpu_usage_pct     FLOAT NOT NULL DEFAULT 0,
  memory_usage_pct  FLOAT NOT NULL DEFAULT 0,
  disk_usage_pct    FLOAT NOT NULL DEFAULT 0,
  node_count        INT NOT NULL DEFAULT 0,
  pod_count         INT NOT NULL DEFAULT 0,
  healthy_nodes     INT NOT NULL DEFAULT 0,
  pending_pods      INT NOT NULL DEFAULT 0,
  network_latency_ms FLOAT DEFAULT 0,
  health_score      FLOAT NOT NULL DEFAULT 100,
  collected_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cluster_health_tenant ON cluster_health(tenant_id);
CREATE INDEX idx_cluster_health_cluster ON cluster_health(cluster_id);
CREATE INDEX idx_cluster_health_collected ON cluster_health(collected_at DESC);
CREATE INDEX idx_cluster_health_score ON cluster_health(health_score);

-- cross_cluster_jobs 表（跨集群任务）
CREATE TABLE IF NOT EXISTS cross_cluster_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_name          VARCHAR(200) NOT NULL,
  job_type          VARCHAR(50) NOT NULL,                    -- deploy, migrate, sync, backup, test
  source_cluster_id UUID REFERENCES federation_clusters(id) ON DELETE SET NULL,
  target_cluster_id UUID REFERENCES federation_clusters(id) ON DELETE SET NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, cancelled
  priority          VARCHAR(20) NOT NULL DEFAULT 'normal',   -- critical, high, normal, low
  payload           JSONB NOT NULL DEFAULT '{}',
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error_message     TEXT,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cross_cluster_jobs_tenant ON cross_cluster_jobs(tenant_id);
CREATE INDEX idx_cross_cluster_jobs_status ON cross_cluster_jobs(status);
CREATE INDEX idx_cross_cluster_jobs_type ON cross_cluster_jobs(job_type);
CREATE INDEX idx_cross_cluster_jobs_source ON cross_cluster_jobs(source_cluster_id);
CREATE INDEX idx_cross_cluster_jobs_target ON cross_cluster_jobs(target_cluster_id);

-- RLS
ALTER TABLE federation_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_cluster_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_federation_clusters ON federation_clusters
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_cluster_health ON cluster_health
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_cross_cluster_jobs ON cross_cluster_jobs
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
