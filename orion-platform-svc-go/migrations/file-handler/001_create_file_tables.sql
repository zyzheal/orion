-- 001_create_file_tables.sql
-- File handler: file_records and storage_backends tables

CREATE TABLE IF NOT EXISTS file_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(512) NOT NULL,
    original_name VARCHAR(512) NOT NULL,
    type VARCHAR(255),
    extension VARCHAR(16),
    size BIGINT DEFAULT 0,
    storage_type VARCHAR(32) NOT NULL DEFAULT 'local',
    storage_path VARCHAR(1024) NOT NULL,
    bucket VARCHAR(255),
    category VARCHAR(64),
    owner VARCHAR(255),
    visibility VARCHAR(32) NOT NULL DEFAULT 'private',
    tags TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage_backends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL,
    config JSONB,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_file_records_tenant ON file_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_file_records_category ON file_records(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_file_records_storage_path ON file_records(storage_path);
CREATE INDEX IF NOT EXISTS idx_file_records_visibility ON file_records(visibility);
CREATE INDEX IF NOT EXISTS idx_file_records_created ON file_records(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_storage_backends_tenant ON storage_backends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storage_backends_enabled ON storage_backends(tenant_id, enabled);
