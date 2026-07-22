CREATE TABLE IF NOT EXISTS quality_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    rule_id UUID NOT NULL REFERENCES data_quality_rules(id),
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255),
    check_type VARCHAR(50) NOT NULL,
    passed_count BIGINT NOT NULL DEFAULT 0,
    failed_count BIGINT NOT NULL DEFAULT 0,
    total_count BIGINT NOT NULL DEFAULT 0,
    score DECIMAL(5,2),
    details JSONB,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_quality_results_tenant ON quality_results(tenant_id);
CREATE INDEX idx_quality_results_table ON quality_results(table_name);
