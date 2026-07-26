-- Migration 001: Digital Twin Service Tables
-- 数字孪生服务：系统状态镜像、沙箱隔离、流量录制与回放

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Digital Twins table
CREATE TABLE IF NOT EXISTS digital_twins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  config          JSONB NOT NULL DEFAULT '{}',
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_digital_twins_tenant ON digital_twins(tenant_id);
CREATE INDEX idx_digital_twins_status ON digital_twins(status);

-- Digital Twin Snapshots table
CREATE TABLE IF NOT EXISTS digital_twin_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id       UUID NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL,
  config        JSONB NOT NULL DEFAULT '{}',
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_snapshots_twin ON digital_twin_snapshots(twin_id);
CREATE INDEX idx_snapshots_tenant ON digital_twin_snapshots(tenant_id);

-- Sandbox Instances table
CREATE TABLE IF NOT EXISTS sandbox_instances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  twin_id       UUID REFERENCES digital_twins(id) ON DELETE SET NULL,
  snapshot_id   UUID REFERENCES digital_twin_snapshots(id) ON DELETE SET NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'running',
  endpoint      VARCHAR(512),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sandboxes_tenant ON sandbox_instances(tenant_id);
CREATE INDEX idx_sandboxes_twin ON sandbox_instances(twin_id);
CREATE INDEX idx_sandboxes_status ON sandbox_instances(status);

-- Recording Sessions table
CREATE TABLE IF NOT EXISTS recording_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id       UUID NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'recording',
  record_count  INTEGER NOT NULL DEFAULT 0,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at    TIMESTAMPTZ
);
CREATE INDEX idx_recordings_twin ON recording_sessions(twin_id);
CREATE INDEX idx_recordings_tenant ON recording_sessions(tenant_id);

-- Traffic Records table
CREATE TABLE IF NOT EXISTS traffic_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id       UUID NOT NULL,
  tenant_id     UUID NOT NULL,
  recording_id  UUID REFERENCES recording_sessions(id) ON DELETE SET NULL,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  method        VARCHAR(10),
  path          VARCHAR(1024),
  request       JSONB,
  response      JSONB,
  duration_ms   INTEGER
);
CREATE INDEX idx_traffic_recording ON traffic_records(recording_id);
CREATE INDEX idx_traffic_twin ON traffic_records(twin_id);
CREATE INDEX idx_traffic_timestamp ON traffic_records(timestamp);

-- Replay Sessions table
CREATE TABLE IF NOT EXISTS replay_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id         UUID NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  recording_id    UUID NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'replaying',
  speed_multiplier INTEGER NOT NULL DEFAULT 1,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_replay_twin ON replay_sessions(twin_id);
CREATE INDEX idx_replay_tenant ON replay_sessions(tenant_id);

-- Replay Results table
CREATE TABLE IF NOT EXISTS replay_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id         UUID NOT NULL,
  recording_id    UUID NOT NULL,
  total_requests  INTEGER NOT NULL DEFAULT 0,
  succeeded       INTEGER NOT NULL DEFAULT 0,
  failed          INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_replay_results_twin ON replay_results(twin_id);

-- Rollback:
-- DROP TABLE IF EXISTS replay_results, replay_sessions, traffic_records, recording_sessions, sandbox_instances, digital_twin_snapshots, digital_twins;