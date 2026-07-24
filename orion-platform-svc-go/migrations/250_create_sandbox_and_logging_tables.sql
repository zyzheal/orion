-- Migration #250: Create sandbox_jobs and log_entries tables
-- P0-6: Agent sandbox execution service (isolated code execution)
-- P0-9: Centralized log management service (structured log aggregation)

-- =============================================================================
-- sandbox_jobs: Agent code execution jobs with resource limits
-- =============================================================================
CREATE TABLE IF NOT EXISTS sandbox_jobs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed, timeout
    max_cpu NUMERIC(5,2) DEFAULT 1.0,
    max_memory BIGINT DEFAULT 134217728,  -- 128 MB in bytes
    timeout_sec BIGINT DEFAULT 30,
    network BOOLEAN DEFAULT FALSE,
    file_access BOOLEAN DEFAULT FALSE,
    exit_code INTEGER DEFAULT 0,
    stdout TEXT DEFAULT '',
    stderr TEXT DEFAULT '',
    logs JSONB DEFAULT '[]',              -- sandbox event log lines
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key to tenants
ALTER TABLE sandbox_jobs ADD CONSTRAINT fk_sandbox_jobs_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sandbox_jobs_tenant ON sandbox_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_jobs_status ON sandbox_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sandbox_jobs_language ON sandbox_jobs(language);
CREATE INDEX IF NOT EXISTS idx_sandbox_jobs_created ON sandbox_jobs(created_at DESC);

-- =============================================================================
-- log_entries: Structured log records for centralized logging
-- =============================================================================
CREATE TABLE IF NOT EXISTS log_entries (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    service VARCHAR(255) NOT NULL,
    level VARCHAR(20) NOT NULL,   -- DEBUG, INFO, WARN, ERROR
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    trace_id VARCHAR(255) DEFAULT '',
    metadata JSONB DEFAULT '{}',  -- flexible schema for arbitrary metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key to tenants
ALTER TABLE log_entries ADD CONSTRAINT fk_log_entries_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_log_entries_tenant ON log_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_service ON log_entries(service);
CREATE INDEX IF NOT EXISTS idx_log_entries_level ON log_entries(level);
CREATE INDEX IF NOT EXISTS idx_log_entries_trace_id ON log_entries(trace_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_timestamp ON log_entries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_log_entries_created ON log_entries(created_at DESC);

-- Combined index for common query pattern
CREATE INDEX IF NOT EXISTS idx_log_entries_tenant_service_time ON log_entries(tenant_id, service, timestamp DESC);
