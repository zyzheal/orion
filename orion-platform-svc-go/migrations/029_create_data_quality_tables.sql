-- 001_create_data_quality_tables.sql
CREATE TABLE IF NOT EXISTS data_quality_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_table VARCHAR(255),
    target_column VARCHAR(255),
    rule_type VARCHAR(50) NOT NULL, -- not_null, unique, range, regex, custom
    expression TEXT,
    threshold DECIMAL(5,2),
    severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_scan_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    rule_id UUID NOT NULL REFERENCES data_quality_rules(id),
    scan_date DATE NOT NULL,
    total_records BIGINT,
    passed_records BIGINT,
    failed_records BIGINT,
    pass_rate DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'completed', -- completed, failed
    errors JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    rule_id UUID NOT NULL REFERENCES data_quality_rules(id),
    scan_result_id UUID NOT NULL REFERENCES quality_scan_results(id),
    message TEXT,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'open', -- open, acknowledged, resolved
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_quality_rules_tenant ON data_quality_rules(tenant_id);
CREATE INDEX idx_quality_scan_results_tenant ON quality_scan_results(tenant_id);
CREATE INDEX idx_quality_scan_results_rule ON quality_scan_results(rule_id);
CREATE INDEX idx_quality_alerts_tenant ON quality_alerts(tenant_id);