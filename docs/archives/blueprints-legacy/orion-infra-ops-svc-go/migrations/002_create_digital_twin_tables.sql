-- Digital Twin Service Schema

-- Digital twin configurations (enhanced from skeleton)
CREATE TABLE IF NOT EXISTS digital_twins (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    environment VARCHAR(32) NOT NULL DEFAULT 'dev',
    services JSONB NOT NULL DEFAULT '[]',
    sync_interval INT NOT NULL DEFAULT 300,
    data_retention_days INT NOT NULL DEFAULT 30,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    health_score INT NOT NULL DEFAULT 100,
    service_states JSONB NOT NULL DEFAULT '{}',
    last_sync_at TIMESTAMPTZ,
    entity_type VARCHAR(64) NOT NULL DEFAULT '',
    state JSONB NOT NULL DEFAULT '{}',
    config JSONB DEFAULT '{}',
    last_synced TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_digital_twins_tenant ON digital_twins(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_digital_twins_status ON digital_twins(tenant_id, status);

-- Twin snapshots: point-in-time environment snapshots
CREATE TABLE IF NOT EXISTS twin_snapshots (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    environment VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'creating',
    components JSONB NOT NULL DEFAULT '[]',
    topology JSONB NOT NULL DEFAULT '{}',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    storage_path TEXT,
    config JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(128),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_twin_snapshots_tenant ON twin_snapshots(tenant_id, created_at);

-- Twin sandboxes: isolated testing environments
CREATE TABLE IF NOT EXISTS twin_sandboxes (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    twin_id UUID NOT NULL,
    name VARCHAR(256) NOT NULL,
    snapshot_id UUID,
    status VARCHAR(32) NOT NULL DEFAULT 'creating',
    endpoint TEXT NOT NULL,
    resources JSONB NOT NULL DEFAULT '{"cpu":"500m","memory":"512Mi","replicas":1}',
    env_vars JSONB NOT NULL DEFAULT '{}',
    network_isolation BOOLEAN NOT NULL DEFAULT true,
    health_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    last_health_check TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_twin_sandboxes_twin ON twin_sandboxes(twin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_twin_sandboxes_tenant ON twin_sandboxes(tenant_id, created_at);

-- Recording sessions: traffic capture sessions
CREATE TABLE IF NOT EXISTS recording_sessions (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    twin_id UUID NOT NULL,
    name VARCHAR(256) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    records JSONB NOT NULL DEFAULT '[]',
    filter_patterns JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paused_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_recording_sessions_twin ON recording_sessions(twin_id, started_at);
CREATE INDEX IF NOT EXISTS idx_recording_sessions_tenant ON recording_sessions(tenant_id, started_at);

-- Replay sessions: traffic replay against sandboxes
CREATE TABLE IF NOT EXISTS replay_sessions (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    twin_id UUID NOT NULL,
    recording_session_id UUID NOT NULL,
    sandbox_endpoint TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    total_requests INT NOT NULL DEFAULT 0,
    completed_requests INT NOT NULL DEFAULT 0,
    matched_requests INT NOT NULL DEFAULT 0,
    failed_requests INT NOT NULL DEFAULT 0,
    results JSONB NOT NULL DEFAULT '[]',
    config JSONB NOT NULL DEFAULT '{}',
    progress INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_replay_sessions_twin ON replay_sessions(twin_id, started_at);
CREATE INDEX IF NOT EXISTS idx_replay_sessions_recording ON replay_sessions(recording_session_id);
