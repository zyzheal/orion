-- Migration 419: Create DBA query execution audit log table
-- Stores records of direct SQL query executions for auditing

CREATE TABLE IF NOT EXISTS dba_query_audit_log (
    id              VARCHAR(36) PRIMARY KEY,
    tenant_id       VARCHAR(36) NOT NULL,
    user_id         VARCHAR(36) NOT NULL,
    data_source_id  VARCHAR(36) NOT NULL,
    data_source_name VARCHAR(255) NOT NULL,
    sql_text        TEXT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'success',
    row_count       INTEGER NOT NULL DEFAULT 0,
    latency_ms      INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_dba_query_audit_log_tenant_id ON dba_query_audit_log (tenant_id);
CREATE INDEX idx_dba_query_audit_log_user_id ON dba_query_audit_log (user_id);
CREATE INDEX idx_dba_query_audit_log_data_source_id ON dba_query_audit_log (data_source_id);
CREATE INDEX idx_dba_query_audit_log_status ON dba_query_audit_log (status);
CREATE INDEX idx_dba_query_audit_log_created_at ON dba_query_audit_log (created_at DESC);

-- Partition by tenant for scalability (optional, uncomment if needed)
-- CREATE INDEX idx_dba_query_audit_log_tenant_created ON dba_query_audit_log (tenant_id, created_at DESC);
