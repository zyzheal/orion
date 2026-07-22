-- 124: Digital Twin Enhanced (Phase 4)
-- 沙箱管理、流量录制会话、流量回放会话

-- twin_sandboxes 表（数字孪生沙箱）
CREATE TABLE IF NOT EXISTS twin_sandboxes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  twin_id           VARCHAR(100) NOT NULL,
  sandbox_name      VARCHAR(200) NOT NULL,
  snapshot_id       VARCHAR(100),
  status            VARCHAR(30) NOT NULL DEFAULT 'creating',  -- creating, running, stopped, error, destroying
  endpoint          VARCHAR(500) NOT NULL DEFAULT '',
  resources         JSONB NOT NULL DEFAULT '{"cpu": "500m", "memory": "512Mi", "replicas": 1}',
  env_vars          JSONB NOT NULL DEFAULT '{}',
  network_isolation BOOLEAN NOT NULL DEFAULT true,
  health_status     VARCHAR(30) NOT NULL DEFAULT 'unknown',   -- healthy, unhealthy, unknown
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at        TIMESTAMPTZ,
  stopped_at        TIMESTAMPTZ,
  last_health_check TIMESTAMPTZ
);
CREATE INDEX idx_twin_sandboxes_tenant ON twin_sandboxes(tenant_id);
CREATE INDEX idx_twin_sandboxes_twin ON twin_sandboxes(twin_id);
CREATE INDEX idx_twin_sandboxes_status ON twin_sandboxes(status);

-- traffic_recording_sessions 表（流量录制会话）
CREATE TABLE IF NOT EXISTS traffic_recording_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  twin_id           VARCHAR(100) NOT NULL,
  session_name      VARCHAR(200) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'active',    -- active, paused, completed
  records           JSONB NOT NULL DEFAULT '[]',
  filter_patterns   JSONB DEFAULT '[]',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  paused_at         TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);
CREATE INDEX idx_traffic_recording_sessions_tenant ON traffic_recording_sessions(tenant_id);
CREATE INDEX idx_traffic_recording_sessions_twin ON traffic_recording_sessions(twin_id);
CREATE INDEX idx_traffic_recording_sessions_status ON traffic_recording_sessions(status);

-- traffic_replay_sessions 表（流量回放会话）
CREATE TABLE IF NOT EXISTS traffic_replay_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  twin_id               VARCHAR(100) NOT NULL,
  recording_session_id  VARCHAR(100) NOT NULL,
  sandbox_endpoint      VARCHAR(500) NOT NULL DEFAULT '',
  status                VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  total_requests        INT NOT NULL DEFAULT 0,
  completed_requests    INT NOT NULL DEFAULT 0,
  matched_requests      INT NOT NULL DEFAULT 0,
  failed_requests       INT NOT NULL DEFAULT 0,
  results               JSONB NOT NULL DEFAULT '[]',
  config                JSONB NOT NULL DEFAULT '{}',
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  progress              INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_traffic_replay_sessions_tenant ON traffic_replay_sessions(tenant_id);
CREATE INDEX idx_traffic_replay_sessions_twin ON traffic_replay_sessions(twin_id);
CREATE INDEX idx_traffic_replay_sessions_status ON traffic_replay_sessions(status);

-- twin_configs 表（孪生配置 - 用于 TwinConfigService）
CREATE TABLE IF NOT EXISTS twin_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  twin_name           VARCHAR(200) NOT NULL,
  description         TEXT,
  environment         VARCHAR(30) NOT NULL,                   -- dev, staging, prod
  services            JSONB NOT NULL DEFAULT '[]',
  sync_interval       INT NOT NULL DEFAULT 60,
  data_retention_days INT NOT NULL DEFAULT 30,
  status              VARCHAR(30) NOT NULL DEFAULT 'active',  -- active, inactive, error, syncing
  health_score        INT NOT NULL DEFAULT 100,
  service_states      JSONB NOT NULL DEFAULT '{}',
  last_sync_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_twin_configs_tenant ON twin_configs(tenant_id);
CREATE INDEX idx_twin_configs_environment ON twin_configs(environment);
CREATE INDEX idx_twin_configs_status ON twin_configs(status);

-- RLS
ALTER TABLE twin_sandboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_recording_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_replay_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE twin_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_twin_sandboxes ON twin_sandboxes
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_traffic_recording_sessions ON traffic_recording_sessions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_traffic_replay_sessions ON traffic_replay_sessions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_twin_configs ON twin_configs
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
