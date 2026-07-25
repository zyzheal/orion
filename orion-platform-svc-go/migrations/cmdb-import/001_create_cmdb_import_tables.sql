-- 001_create_cmdb_import_tables.sql
-- CMDB Import: cmdb_import_jobs and cmdb_import_records tables
-- Supports importing CMDB CIs, relations, and attributes from multiple sources.

CREATE TABLE IF NOT EXISTS cmdb_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(32) NOT NULL,       -- csv | excel | json | yaml | api | db | sftp
    source_path TEXT NOT NULL,              -- file path, URL, query, or table name
    target_type VARCHAR(32) NOT NULL,       -- ci | relation | attribute
    mapping JSONB DEFAULT '{}',             -- source field → target field mapping
    mode VARCHAR(32) NOT NULL DEFAULT 'upsert', -- create | update | upsert | merge
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending | running | completed | failed | cancelled
    total_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    error TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cmdb_import_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES cmdb_import_jobs(id) ON DELETE CASCADE,
    source_row JSONB DEFAULT '{}',          -- raw source row data as JSON
    target_id VARCHAR(128),                 -- resulting CMDB entity ID
    action VARCHAR(32) NOT NULL,            -- created | updated | skipped | failed
    error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for cmdb_import_jobs
CREATE INDEX IF NOT EXISTS idx_cmdb_import_jobs_tenant ON cmdb_import_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_import_jobs_status ON cmdb_import_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cmdb_import_jobs_created ON cmdb_import_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmdb_import_jobs_source_type ON cmdb_import_jobs(source_type);

-- Indexes for cmdb_import_records
CREATE INDEX IF NOT EXISTS idx_cmdb_import_records_job ON cmdb_import_records(job_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_import_records_action ON cmdb_import_records(job_id, action);
CREATE INDEX IF NOT EXISTS idx_cmdb_import_records_target ON cmdb_import_records(target_id);
