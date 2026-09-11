-- Digital-twin module tables

CREATE TABLE IF NOT EXISTS digital_twins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    source_service VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'created',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
-- 补齐 digital_twins：123_create_digital-twin-simulation_tables.sql 的定义晚于 035_create_digital_twin_tables.sql，按序执行时表已存在
ALTER TABLE digital_twins ADD COLUMN IF NOT EXISTS description VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS entity_type VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS source_id VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS config VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS metadata VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS sync_policy VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS last_sync_time BIGINT, ADD COLUMN IF NOT EXISTS sync_health VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;


CREATE INDEX IF NOT EXISTS idx_digital_twins_tenant_id ON digital_twins(tenant_id);

CREATE TABLE IF NOT EXISTS snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    twin_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_tenant_id ON snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_twin_id ON snapshots(twin_id);

CREATE TABLE IF NOT EXISTS traffic_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    twin_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    request_count BIGINT DEFAULT 0,
    duration VARCHAR(50),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_traffic_records_tenant_id ON traffic_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_traffic_records_twin_id ON traffic_records(twin_id);

CREATE TABLE IF NOT EXISTS recording_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    twin_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'recording',
    record_count BIGINT DEFAULT 0,
    records JSONB,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS replay_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    twin_id VARCHAR(255) NOT NULL,
    recording_session_id VARCHAR(255) NOT NULL,
    sandbox_endpoint VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    progress BIGINT DEFAULT 0,
    total_requests BIGINT DEFAULT 0,
    completed_requests BIGINT DEFAULT 0,
    matched_requests BIGINT DEFAULT 0,
    failed_requests BIGINT DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
