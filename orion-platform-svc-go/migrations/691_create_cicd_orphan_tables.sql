-- 691_create_cicd_orphan_tables.sql
--
-- Missing DDL for the 10 ci-cd-domain orphan tables that internal/ci-cd/*
-- repositories reference but no earlier migration creates.
-- Inventory: docs/orphan-tables-inventory-2026-09-16.md.
--
-- Column shapes read from each repository's INSERT column list and the
-- module's db tags. Notes:
--   * builder_images.env / labels and task_executions.input / output and
--     runners.labels / metadata are JSONB (bound via json.RawMessage /
--     models.JSONB, which marshal JSON on bind).
--   * deploy tables use RETURNING to populate id/created_at, and the models
--     carry nullable approved/started/completed timestamps, so those columns
--     are nullable with no NOT NULL.
--   * stage_executions / task_executions keep pointer/optional error_message,
--     logs, started_at, completed_at, duration_ms.
--   * runners.type / status are VARCHAR(32) matching the enum-style status
--     strings the repository writes.
--
-- Idempotent by construction (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS artifact_registries (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL,
    base_url VARCHAR(512),
    description TEXT,
    config TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifact_registries_tenant ON artifact_registries(tenant_id);

CREATE TABLE IF NOT EXISTS artifact_entries (
    id VARCHAR(36) PRIMARY KEY,
    registry_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(128) NOT NULL,
    content_type VARCHAR(64),
    size BIGINT DEFAULT 0,
    checksum VARCHAR(128),
    storage_path VARCHAR(512),
    metadata TEXT,
    is_latest BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifact_entries_registry ON artifact_entries(registry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_entries_name_ver ON artifact_entries(name, version);

CREATE TABLE IF NOT EXISTS artifact_versions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    artifact_id VARCHAR(36) NOT NULL,
    version VARCHAR(128) NOT NULL,
    build_number INT DEFAULT 0,
    checksum VARCHAR(128),
    size BIGINT DEFAULT 0,
    storage_path VARCHAR(512),
    status VARCHAR(32) DEFAULT 'published',
    metadata TEXT,
    build_job_id VARCHAR(36),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deprecated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_artifact_versions_tenant ON artifact_versions(tenant_id, artifact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_status ON artifact_versions(status);

CREATE TABLE IF NOT EXISTS builder_images (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    image VARCHAR(512) NOT NULL,
    type VARCHAR(32) DEFAULT 'custom',
    version VARCHAR(128),
    description TEXT,
    pull_policy VARCHAR(32) DEFAULT 'IfNotPresent',
    status VARCHAR(32) DEFAULT 'active',
    is_preset BOOLEAN DEFAULT FALSE,
    env JSONB DEFAULT '{}'::jsonb,
    labels JSONB DEFAULT '{}'::jsonb,
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builder_images_name ON builder_images(name);
CREATE INDEX IF NOT EXISTS idx_builder_images_type ON builder_images(type);

CREATE TABLE IF NOT EXISTS deploy_emergencies (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    deployment_id VARCHAR(36) NOT NULL,
    reason TEXT,
    requested_by VARCHAR(64),
    approved_by VARCHAR(64),
    approved_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(32) DEFAULT 'pending',
    post_mortem TEXT,
    metadata TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deploy_emergencies_tenant ON deploy_emergencies(tenant_id, deployment_id);
CREATE INDEX IF NOT EXISTS idx_deploy_emergencies_status ON deploy_emergencies(status);

CREATE TABLE IF NOT EXISTS deploy_progressive_stages (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    deployment_id VARCHAR(36) NOT NULL,
    stage_name VARCHAR(128) NOT NULL,
    stage_order INT DEFAULT 0,
    traffic_percent INT DEFAULT 0,
    instance_count INT DEFAULT 0,
    status VARCHAR(32) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    validation_result TEXT,
    auto_promote BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deploy_progressive_tenant ON deploy_progressive_stages(tenant_id, deployment_id);
CREATE INDEX IF NOT EXISTS idx_deploy_progressive_stage ON deploy_progressive_stages(stage_name);

CREATE TABLE IF NOT EXISTS deployment_events (
    id VARCHAR(36) PRIMARY KEY,
    deployment_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    message TEXT,
    actor_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployment_events_deploy ON deployment_events(deployment_id, created_at ASC);

CREATE TABLE IF NOT EXISTS runners (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL,
    status VARCHAR(32) DEFAULT 'idle',
    endpoint VARCHAR(512),
    capacity INT DEFAULT 1,
    max_concurrent INT DEFAULT 1,
    current_jobs INT DEFAULT 0,
    labels JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runners_tenant ON runners(tenant_id);
CREATE INDEX IF NOT EXISTS idx_runners_status ON runners(status);

CREATE TABLE IF NOT EXISTS stage_executions (
    id VARCHAR(36) PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL,
    stage_id VARCHAR(36),
    stage_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) DEFAULT 'pending',
    error_message TEXT,
    logs TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_executions_run ON stage_executions(run_id);
CREATE INDEX IF NOT EXISTS idx_stage_executions_status ON stage_executions(status);

CREATE TABLE IF NOT EXISTS task_executions (
    id VARCHAR(36) PRIMARY KEY,
    execution_id VARCHAR(36) NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'pending',
    input JSONB DEFAULT '{}'::jsonb,
    output JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    logs TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_executions_exec ON task_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status);