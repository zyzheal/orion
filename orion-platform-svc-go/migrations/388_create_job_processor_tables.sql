-- Migration 388: job-processor tables (was AutoMigrate only)

CREATE TABLE IF NOT EXISTS job_operation_chains (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    error TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_operation_chains_tenant ON job_operation_chains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_operation_chains_status ON job_operation_chains(tenant_id, status);

CREATE TABLE IF NOT EXISTS job_operations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    chain_id VARCHAR(64),
    type VARCHAR(16) NOT NULL,
    target VARCHAR(255) NOT NULL,
    params TEXT DEFAULT '{}',
    result TEXT DEFAULT '{}',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    error TEXT DEFAULT '',
    "order" INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_operations_tenant ON job_operations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_operations_chain ON job_operations(chain_id);
CREATE INDEX IF NOT EXISTS idx_job_operations_order ON job_operations(chain_id, "order");
CREATE INDEX IF NOT EXISTS idx_job_operations_status ON job_operations(tenant_id, status);