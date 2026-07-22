-- Config drift detection
CREATE TABLE IF NOT EXISTS config_drifts (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    config_id UUID NOT NULL,
    config_key VARCHAR(256) NOT NULL,
    environment VARCHAR(32) NOT NULL,
    expected_value TEXT NOT NULL,
    actual_value TEXT NOT NULL,
    drift_type VARCHAR(32) NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(128) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_config_drifts_tenant ON config_drifts(tenant_id, detected_at DESC);
CREATE INDEX idx_config_drifts_unresolved ON config_drifts(tenant_id) WHERE resolved_at IS NULL;

-- Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    key VARCHAR(128) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT false,
    environment VARCHAR(32) NOT NULL DEFAULT 'production',
    flag_type VARCHAR(32) NOT NULL DEFAULT 'boolean',
    rollout_pct INT NOT NULL DEFAULT 100,
    whitelist JSONB NOT NULL DEFAULT '[]',
    variations JSONB NOT NULL DEFAULT '{}',
    tags JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, key, environment)
);
CREATE INDEX idx_feature_flags_tenant ON feature_flags(tenant_id, environment);

-- Git sync configurations
CREATE TABLE IF NOT EXISTS git_sync_configs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    repo_url TEXT NOT NULL,
    branch VARCHAR(128) NOT NULL DEFAULT 'main',
    path VARCHAR(512) NOT NULL DEFAULT '',
    environment VARCHAR(32) NOT NULL DEFAULT 'production',
    auto_sync BOOLEAN NOT NULL DEFAULT true,
    sync_interval_sec INT NOT NULL DEFAULT 300,
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(32) NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_git_sync_configs_tenant ON git_sync_configs(tenant_id);

-- Config change approvals
CREATE TABLE IF NOT EXISTS config_approvals (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    config_key VARCHAR(256) NOT NULL,
    environment VARCHAR(32) NOT NULL,
    current_value TEXT NOT NULL DEFAULT '',
    proposed_value TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    requested_by VARCHAR(128) NOT NULL,
    reviewed_by VARCHAR(128) NOT NULL DEFAULT '',
    review_comment TEXT NOT NULL DEFAULT '',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_config_approvals_tenant ON config_approvals(tenant_id, status, requested_at DESC);
