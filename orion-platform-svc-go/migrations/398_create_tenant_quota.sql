CREATE TABLE IF NOT EXISTS tenant_quota_plan (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    api_rate_limit_per_min INT NOT NULL DEFAULT 1000,
    api_rate_limit_per_hour INT NOT NULL DEFAULT 50000,
    max_cis INT NOT NULL DEFAULT 10000,
    max_users INT NOT NULL DEFAULT 500,
    max_storages_mb BIGINT NOT NULL DEFAULT 10240,
    max_pipelines INT NOT NULL DEFAULT 100,
    max_concurrent_jobs INT NOT NULL DEFAULT 20,
    max_alerts_per_day INT NOT NULL DEFAULT 10000,
    sla_tier VARCHAR(20) NOT NULL DEFAULT 'standard',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_sla (sla_tier)
);

CREATE TABLE IF NOT EXISTS tenant_quota_usage (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    metric VARCHAR(100) NOT NULL,
    current_value BIGINT NOT NULL DEFAULT 0,
    peak_value BIGINT NOT NULL DEFAULT 0,
    window_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    window_end TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reset_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_metric (tenant_id, metric),
    INDEX idx_reset (reset_at)
);

CREATE TABLE IF NOT EXISTS tenant_quota_alert (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    metric VARCHAR(100) NOT NULL,
    current_value BIGINT NOT NULL,
    limit_value BIGINT NOT NULL,
    usage_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
    alert_level VARCHAR(20) NOT NULL DEFAULT 'warning',
    notified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_metric (metric)
);
