-- Pipeline-Sse module tables (auto-generated)

CREATE TABLE IF NOT EXISTS s_s_e_log_event_records (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    pipeline_id VARCHAR(255) NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    stage_id VARCHAR(255) NOT NULL,
    stage_name VARCHAR(255) NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    log_line VARCHAR(255) NOT NULL,
    level VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_s_s_e_log_event_records_tenant ON s_s_e_log_event_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_s_s_e_log_event_records_created ON s_s_e_log_event_records(created_at DESC);

CREATE TABLE IF NOT EXISTS s_s_e_status_event_records (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    pipeline_id VARCHAR(255) NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    stage_id VARCHAR(255) NOT NULL,
    stage_name VARCHAR(255) NOT NULL,
    progress DOUBLE PRECISION NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_s_s_e_status_event_records_tenant ON s_s_e_status_event_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_s_s_e_status_event_records_created ON s_s_e_status_event_records(created_at DESC);

