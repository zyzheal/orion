-- 109: Digital Twin
-- 数字孪生快照、孪生配置、孪生重放日志

-- twin_configurations 表（数字孪生配置）
CREATE TABLE IF NOT EXISTS twin_configurations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  twin_name         VARCHAR(200) NOT NULL,
  description       TEXT,
  target_type       VARCHAR(50) NOT NULL,                        -- pipeline, service, infrastructure, cluster
  target_id         VARCHAR(200) NOT NULL,
  sync_mode         VARCHAR(30) NOT NULL DEFAULT 'realtime',     -- realtime, periodic, on_demand
  sync_interval_sec INT NOT NULL DEFAULT 60,
  fidelity_level    VARCHAR(30) NOT NULL DEFAULT 'high',         -- low, medium, high, full
  data_sources      JSONB NOT NULL DEFAULT '[]',
  simulation_config JSONB NOT NULL DEFAULT '{}',
  status            VARCHAR(30) NOT NULL DEFAULT 'active',       -- active, paused, archived
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_twin_configurations_tenant ON twin_configurations(tenant_id);
CREATE INDEX idx_twin_configurations_target ON twin_configurations(target_type, target_id);
CREATE INDEX idx_twin_configurations_status ON twin_configurations(status);
CREATE INDEX idx_twin_configurations_sync ON twin_configurations(sync_mode);

-- twin_snapshots 表（数字孪生快照）
CREATE TABLE IF NOT EXISTS twin_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  twin_id           UUID NOT NULL REFERENCES twin_configurations(id) ON DELETE CASCADE,
  snapshot_time     TIMESTAMPTZ NOT NULL DEFAULT now(),
  state_hash        VARCHAR(100) NOT NULL,
  state_data        JSONB NOT NULL DEFAULT '{}',
  metrics           JSONB NOT NULL DEFAULT '{}',
  events            JSONB NOT NULL DEFAULT '[]',
  size_bytes        BIGINT DEFAULT 0,
  snapshot_type     VARCHAR(30) NOT NULL DEFAULT 'full',         -- full, incremental, differential
  tags              JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_twin_snapshots_tenant ON twin_snapshots(tenant_id);
CREATE INDEX idx_twin_snapshots_twin ON twin_snapshots(twin_id);
CREATE INDEX idx_twin_snapshots_time ON twin_snapshots(snapshot_time DESC);
CREATE INDEX idx_twin_snapshots_type ON twin_snapshots(snapshot_type);

-- twin_replay_logs 表（孪生重放日志）
CREATE TABLE IF NOT EXISTS twin_replay_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  twin_id           UUID NOT NULL REFERENCES twin_configurations(id) ON DELETE CASCADE,
  replay_name       VARCHAR(200) NOT NULL,
  start_snapshot_id UUID REFERENCES twin_snapshots(id) ON DELETE SET NULL,
  end_snapshot_id   UUID REFERENCES twin_snapshots(id) ON DELETE SET NULL,
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ NOT NULL,
  playback_speed    FLOAT NOT NULL DEFAULT 1.0,
  status            VARCHAR(30) NOT NULL DEFAULT 'completed',    -- running, completed, failed, cancelled
  result            JSONB NOT NULL DEFAULT '{}',
  deviations        JSONB NOT NULL DEFAULT '[]',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_twin_replay_logs_tenant ON twin_replay_logs(tenant_id);
CREATE INDEX idx_twin_replay_logs_twin ON twin_replay_logs(twin_id);
CREATE INDEX idx_twin_replay_logs_status ON twin_replay_logs(status);
CREATE INDEX idx_twin_replay_logs_created ON twin_replay_logs(created_at DESC);

-- RLS
ALTER TABLE twin_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE twin_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE twin_replay_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_twin_configurations ON twin_configurations
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_twin_snapshots ON twin_snapshots
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
CREATE POLICY tenant_isolation_twin_replay_logs ON twin_replay_logs
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
