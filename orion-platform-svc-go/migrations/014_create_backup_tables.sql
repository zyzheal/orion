-- Backup & Recovery tables
-- Created: 2026-07-12

CREATE TABLE IF NOT EXISTS backup_jobs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    type VARCHAR(64) NOT NULL,
    source VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    progress DECIMAL(5,2) DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_policies (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(255) NOT NULL,
    schedule VARCHAR(128),
    retention_days INTEGER DEFAULT 7,
    sources JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_storages (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    provider VARCHAR(64) NOT NULL,
    config JSONB DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_restores (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    backup_job_id UUID REFERENCES backup_jobs(id),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    restored_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_jobs_tenant ON backup_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_status ON backup_jobs(status);
CREATE INDEX IF NOT EXISTS idx_backup_policies_tenant ON backup_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_backup_storages_tenant ON backup_storages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_backup_storages_provider ON backup_storages(provider);
CREATE INDEX IF NOT EXISTS idx_backup_restores_tenant ON backup_restores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_backup_restores_job ON backup_restores(backup_job_id);
CREATE INDEX IF NOT EXISTS idx_backup_restores_status ON backup_restores(status);
