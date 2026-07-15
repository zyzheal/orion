-- Config-Mgmt-Enhanced module tables (auto-generated)

CREATE TABLE IF NOT EXISTS config_mgmts (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_config_mgmts_tenant ON config_mgmts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_mgmts_created ON config_mgmts(created_at DESC);

CREATE TABLE IF NOT EXISTS change_requests (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    config_key VARCHAR(255) NOT NULL,
    config_group VARCHAR(255) NOT NULL,
    environment VARCHAR(255) NOT NULL,
    change_type VARCHAR(255) NOT NULL,
    old_value VARCHAR(255) NOT NULL,
    new_value VARCHAR(255) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    risk_level VARCHAR(255) NOT NULL,
    requester VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    execution_plan VARCHAR(255) NOT NULL,
    rollback_plan VARCHAR(255) NOT NULL,
    approvals VARCHAR(255) NOT NULL,
    required_approvals BIGINT NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    executed_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by VARCHAR(255),
    rolled_back_at TIMESTAMP WITH TIME ZONE,
    rolled_back_by VARCHAR(255),
    approvals_list TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_change_requests_tenant ON change_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_created ON change_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS change_histories (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    change_request_id VARCHAR(255) NOT NULL,
    config_key VARCHAR(255) NOT NULL,
    config_group VARCHAR(255) NOT NULL,
    environment VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    old_value VARCHAR(255) NOT NULL,
    new_value VARCHAR(255) NOT NULL,
    notes VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_change_histories_tenant ON change_histories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_change_histories_created ON change_histories(created_at DESC);

CREATE TABLE IF NOT EXISTS drift_reports (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    config_group VARCHAR(255) NOT NULL,
    drift_status VARCHAR(255) NOT NULL,
    expected_config VARCHAR(255) NOT NULL,
    actual_config VARCHAR(255) NOT NULL,
    drift_items VARCHAR(255) NOT NULL,
    total_drifts BIGINT NOT NULL,
    critical_drifts BIGINT NOT NULL,
    auto_remediation_enabled BOOLEAN NOT NULL,
    remediation_log VARCHAR(255) NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_checked_at TIMESTAMP WITH TIME ZONE NOT NULL,
    drift_items_list TEXT NOT NULL,
    remediation_log_list TEXT NOT NULL,
    expected_config_data JSONB,
    actual_config_data JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_drift_reports_tenant ON drift_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drift_reports_created ON drift_reports(created_at DESC);

