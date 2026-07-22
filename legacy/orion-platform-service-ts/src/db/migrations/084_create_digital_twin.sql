-- Migration 084: Digital Twin (Phase 4)
-- 数字孪生和流量回放

CREATE TABLE IF NOT EXISTS twin_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  environment     VARCHAR(50) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'creating',
  components      JSONB NOT NULL DEFAULT '[]',
  topology        JSONB NOT NULL DEFAULT '{}',
  size_bytes      BIGINT DEFAULT 0,
  storage_path    VARCHAR(500),
  created_by      UUID REFERENCES users(id),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_twin_snapshots_tenant ON twin_snapshots(tenant_id);
CREATE INDEX idx_twin_snapshots_env ON twin_snapshots(environment);
CREATE INDEX idx_twin_snapshots_status ON twin_snapshots(status);

CREATE TABLE IF NOT EXISTS traffic_recordings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_env            VARCHAR(50) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'recording',
  path_prefixes         TEXT[] DEFAULT '{}',
  desensitization_rules TEXT[] DEFAULT '{}',
  request_count         INT DEFAULT 0,
  size_bytes            BIGINT DEFAULT 0,
  storage_path          VARCHAR(500),
  started_by            UUID REFERENCES users(id),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX idx_traffic_recordings_tenant ON traffic_recordings(tenant_id);
CREATE INDEX idx_traffic_recordings_status ON traffic_recordings(status);

CREATE TABLE IF NOT EXISTS traffic_replays (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recording_id        UUID NOT NULL REFERENCES traffic_recordings(id) ON DELETE CASCADE,
  target_env          VARCHAR(50) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  speed_multiplier    DECIMAL(3,1) DEFAULT 1.0,
  parallelism         INT DEFAULT 1,
  progress            INT DEFAULT 0,
  matched_count       INT DEFAULT 0,
  mismatched_count    INT DEFAULT 0,
  skipped_count       INT DEFAULT 0,
  report              JSONB DEFAULT '{}',
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_traffic_replays_recording ON traffic_replays(recording_id);
CREATE INDEX idx_traffic_replays_status ON traffic_replays(status);
