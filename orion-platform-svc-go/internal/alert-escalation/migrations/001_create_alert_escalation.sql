CREATE TABLE IF NOT EXISTS escalation_policy (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    severity VARCHAR(20) NOT NULL DEFAULT 'all',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    rules JSON NOT NULL,
    created_by VARCHAR(100) DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_severity (severity)
);

CREATE TABLE IF NOT EXISTS escalation_trigger (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    policy_id VARCHAR(36) NOT NULL,
    alert_id VARCHAR(36) NOT NULL,
    level INT NOT NULL DEFAULT 1,
    target VARCHAR(200) NOT NULL,
    channel VARCHAR(50) NOT NULL DEFAULT 'email',
    message TEXT DEFAULT '',
    triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    resolved_at TIMESTAMP DEFAULT NULL,
    INDEX idx_policy (policy_id),
    INDEX idx_alert (alert_id),
    INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS alert_closure (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    alert_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    acknowledged_by VARCHAR(100) DEFAULT '',
    acknowledged_at TIMESTAMP DEFAULT NULL,
    resolved_by VARCHAR(100) DEFAULT '',
    resolved_at TIMESTAMP DEFAULT NULL,
    resolution_note TEXT DEFAULT '',
    mttr_seconds BIGINT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_alert (alert_id),
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS alert_metrics (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL DEFAULT '',
    metric_date DATE NOT NULL,
    total_alerts INT NOT NULL DEFAULT 0,
    acknowledged_count INT NOT NULL DEFAULT 0,
    resolved_count INT NOT NULL DEFAULT 0,
    escalated_count INT NOT NULL DEFAULT 0,
    avg_response_seconds BIGINT NOT NULL DEFAULT 0,
    avg_resolution_seconds BIGINT NOT NULL DEFAULT 0,
    p95_response_seconds BIGINT NOT NULL DEFAULT 0,
    p95_resolution_seconds BIGINT NOT NULL DEFAULT 0,
    sla_breach_count INT NOT NULL DEFAULT 0,
    auto_remediation_success INT NOT NULL DEFAULT 0,
    auto_remediation_failed INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_date (metric_date),
    INDEX idx_tenant (tenant_id)
);