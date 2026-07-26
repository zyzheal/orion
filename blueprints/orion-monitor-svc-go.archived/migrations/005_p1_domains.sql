-- 003_p1_domains.sql - Monitor P1 domain tables
-- Alert Correlation
CREATE TABLE IF NOT EXISTS correlation_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    root_alert_id UUID,
    alert_ids JSONB DEFAULT '[]',
    group_type VARCHAR(20) NOT NULL,
    confidence FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS correlation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    group_type VARCHAR(20) NOT NULL,
    time_window_sec INT DEFAULT 300,
    is_enabled BOOLEAN DEFAULT TRUE,
    conditions TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_corr_groups_tenant ON correlation_groups(tenant_id);
CREATE INDEX idx_corr_rules_tenant ON correlation_rules(tenant_id);
