-- Migration: 361_create_cloud_sync_jobs.sql
-- Purpose: Persist cloud resource sync job state and per-resource sync tracking
-- Supports Task 4.38: MultiCloud real sync with status tracking

-- ============================================================================
-- Cloud Sync Jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS cloud_sync_jobs (
    id                  VARCHAR(50) PRIMARY KEY,
    tenant_id           VARCHAR(50) NOT NULL,
    account_id          VARCHAR(50) NOT NULL REFERENCES cloud_accounts(id) ON DELETE CASCADE,
    provider            VARCHAR(50) NOT NULL,
    sync_type           VARCHAR(30) NOT NULL DEFAULT 'full',   -- full, incremental, delta
    status              VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, partial
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    resources_discovered INTEGER NOT NULL DEFAULT 0,
    resources_created   INTEGER NOT NULL DEFAULT 0,
    resources_updated   INTEGER NOT NULL DEFAULT 0,
    resources_deleted   INTEGER NOT NULL DEFAULT 0,
    resources_skipped   INTEGER NOT NULL DEFAULT 0,
    errors              JSONB NOT NULL DEFAULT '[]',
    conflict_resolutions JSONB NOT NULL DEFAULT '[]',
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csj_tenant ON cloud_sync_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_csj_account ON cloud_sync_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_csj_status ON cloud_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_csj_started ON cloud_sync_jobs(started_at DESC);

-- ============================================================================
-- Cloud Resource Sync State
-- ============================================================================

CREATE TABLE IF NOT EXISTS cloud_resource_sync_state (
    id                  VARCHAR(50) PRIMARY KEY,
    tenant_id           VARCHAR(50) NOT NULL,
    account_id          VARCHAR(50) NOT NULL REFERENCES cloud_accounts(id) ON DELETE CASCADE,
    resource_type       VARCHAR(100) NOT NULL,
    provider_resource_id VARCHAR(200) NOT NULL,
    resource_name       VARCHAR(200),
    region              VARCHAR(100) NOT NULL,
    provider_state      VARCHAR(30) NOT NULL,
    orion_state         VARCHAR(30) NOT NULL DEFAULT 'running',
    sync_status         VARCHAR(20) NOT NULL DEFAULT 'synced', -- synced, drifted, conflict, deleted, new
    last_sync_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_discovered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    drift_detected_at   TIMESTAMPTZ,
    conflict_reason     TEXT,
    spec_hash           VARCHAR(64),
    provider_spec       JSONB NOT NULL DEFAULT '{}',
    orion_spec          JSONB NOT NULL DEFAULT '{}',
    tags                JSONB NOT NULL DEFAULT '{}',
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, account_id, provider_resource_id)
);

CREATE INDEX IF NOT EXISTS idx_crss_tenant ON cloud_resource_sync_state(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crss_account ON cloud_resource_sync_state(account_id);
CREATE INDEX IF NOT EXISTS idx_crss_sync_status ON cloud_resource_sync_state(sync_status);
CREATE INDEX IF NOT EXISTS idx_crss_provider_resource ON cloud_resource_sync_state(provider_resource_id);
CREATE INDEX IF NOT EXISTS idx_crss_last_sync ON cloud_resource_sync_state(last_sync_at DESC);

-- RLS
ALTER TABLE cloud_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_resource_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cloud_sync_jobs ON cloud_sync_jobs
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE POLICY tenant_isolation_cloud_resource_sync_state ON cloud_resource_sync_state
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );
