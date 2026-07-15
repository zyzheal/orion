-- Pipeline-Audit-Log module tables (auto-generated)

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    stage_id VARCHAR(255),
    task_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    outcome VARCHAR(255) NOT NULL,
    duration_ms BIGINT,
    input_summary VARCHAR(255),
    output_summary VARCHAR(255),
    error_message VARCHAR(255),
    metadata VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

