-- FinOps cost records (entity-level cost tracking)
CREATE TABLE IF NOT EXISTS finops_cost_records (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(32) NOT NULL DEFAULT 'project',
    entity_id VARCHAR(128) NOT NULL,
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    category VARCHAR(64) NOT NULL DEFAULT '',
    environment VARCHAR(64),
    tags TEXT,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_finops_cost_records_entity ON finops_cost_records(entity_type, entity_id);
CREATE INDEX idx_finops_cost_records_timestamp ON finops_cost_records(timestamp);

-- FinOps reports (generated cost reports)
CREATE TABLE IF NOT EXISTS finops_reports (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    period VARCHAR(16) NOT NULL DEFAULT 'monthly',
    total_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    breakdown TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_finops_reports_tenant ON finops_reports(tenant_id);

-- ROI analyses
CREATE TABLE IF NOT EXISTS finops_roi_analyses (
    id UUID PRIMARY KEY,
    investment_type VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    savings DOUBLE PRECISION NOT NULL DEFAULT 0,
    period VARCHAR(16) NOT NULL DEFAULT 'monthly',
    roi_percentage DOUBLE PRECISION NOT NULL DEFAULT 0,
    payback_months DOUBLE PRECISION,
    description TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '{}',
    analyzed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_finops_roi_investment_type ON finops_roi_analyses(investment_type);

-- Cost comparisons
CREATE TABLE IF NOT EXISTS finops_cost_comparisons (
    id UUID PRIMARY KEY,
    description TEXT NOT NULL,
    before_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    after_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    savings DOUBLE PRECISION NOT NULL DEFAULT 0,
    savings_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
    period VARCHAR(16) NOT NULL DEFAULT 'monthly'
);

-- Legacy budget alerts (legacy format)
CREATE TABLE IF NOT EXISTS finops_budget_alerts (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    environment VARCHAR(64) NOT NULL DEFAULT '',
    budget_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    threshold_percent DOUBLE PRECISION NOT NULL DEFAULT 80,
    current_spend DOUBLE PRECISION NOT NULL DEFAULT 0,
    triggered BOOLEAN NOT NULL DEFAULT FALSE,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    period VARCHAR(16) NOT NULL DEFAULT 'monthly',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_finops_budget_alerts_tenant ON finops_budget_alerts(tenant_id);
