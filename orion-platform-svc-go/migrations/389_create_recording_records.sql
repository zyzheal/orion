-- Migration 389: recording_records table (support digital-twin recording detail)
-- Stores individual recording records that are aggregated per recording session.

CREATE TABLE IF NOT EXISTS recording_records (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    recording_session_id VARCHAR(64) NOT NULL,
    twin_id VARCHAR(64) NOT NULL,
    request_method VARCHAR(8) DEFAULT '',
    request_path TEXT DEFAULT '',
    request_headers JSONB DEFAULT '{}',
    request_body JSONB DEFAULT '{}',
    response_status INT DEFAULT 0,
    response_headers JSONB DEFAULT '{}',
    response_body JSONB DEFAULT '{}',
    duration_ms INT DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recording_records_session ON recording_records(recording_session_id);
CREATE INDEX IF NOT EXISTS idx_recording_records_twin ON recording_records(twin_id);
CREATE INDEX IF NOT EXISTS idx_recording_records_tenant ON recording_records(tenant_id);