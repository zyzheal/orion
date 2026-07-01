-- Digital Twin Tables
-- Migration 397

-- Digital twins: registered service twins
CREATE TABLE IF NOT EXISTS digital_twins (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  source_service TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digital_twins_tenant ON digital_twins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_digital_twins_status ON digital_twins(status);
CREATE INDEX IF NOT EXISTS idx_digital_twins_created_at ON digital_twins(created_at DESC);

-- Snapshots: twin state snapshots
CREATE TABLE IF NOT EXISTS digital_twin_snapshots (
  id TEXT PRIMARY KEY,
  twin_id TEXT NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digital_twin_snapshots_twin ON digital_twin_snapshots(twin_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_snapshots_tenant ON digital_twin_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_snapshots_created_at ON digital_twin_snapshots(created_at DESC);

-- Traffic records: record/replay traffic logs
CREATE TABLE IF NOT EXISTS digital_twin_traffic_records (
  id TEXT PRIMARY KEY,
  twin_id TEXT NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('record', 'replay')),
  request_count INTEGER NOT NULL DEFAULT 0,
  duration TEXT NOT NULL DEFAULT '0s',
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_digital_twin_traffic_twin ON digital_twin_traffic_records(twin_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_traffic_tenant ON digital_twin_traffic_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_traffic_started_at ON digital_twin_traffic_records(started_at DESC);

-- Replay sessions: traffic replay execution sessions
CREATE TABLE IF NOT EXISTS digital_twin_replay_sessions (
  id TEXT PRIMARY KEY,
  twin_id TEXT NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  recording_session_id TEXT NOT NULL,
  sandbox_endpoint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  progress INTEGER NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  completed_requests INTEGER NOT NULL DEFAULT 0,
  matched_requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_digital_twin_replay_twin ON digital_twin_replay_sessions(twin_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_replay_tenant ON digital_twin_replay_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_replay_status ON digital_twin_replay_sessions(status);
