-- 003_p1_domains.sql - AI service P1 domain tables
-- Auto-Recovery
CREATE TABLE IF NOT EXISTS auto_recovery_rules (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger VARCHAR(50) NOT NULL,
    condition TEXT NOT NULL,
    action VARCHAR(50) NOT NULL,
    target VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    max_retries INT DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recovery_actions (
    id VARCHAR(64) PRIMARY KEY,
    rule_id VARCHAR(64) REFERENCES auto_recovery_rules(id),
    tenant_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    result TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_auto_recovery_tenant ON auto_recovery_rules(tenant_id);
CREATE INDEX idx_recovery_actions_rule ON recovery_actions(rule_id);
CREATE INDEX idx_recovery_actions_tenant ON recovery_actions(tenant_id);
