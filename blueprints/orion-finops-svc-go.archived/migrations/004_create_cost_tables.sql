-- Cost records table
CREATE TABLE IF NOT EXISTS cost_records (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    service VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255),
    region VARCHAR(255),
    cost DECIMAL(15,4) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    category VARCHAR(50) NOT NULL DEFAULT 'other',
    tags JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_records_tenant_date ON cost_records(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_cost_records_tenant_service ON cost_records(tenant_id, service);
CREATE INDEX IF NOT EXISTS idx_cost_records_date ON cost_records(date DESC);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    period VARCHAR(20) NOT NULL DEFAULT 'monthly',
    alert_threshold DECIMAL(5,2) NOT NULL DEFAULT 80.0,
    current_spend DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budgets_tenant_status ON budgets(tenant_id, status);

-- Cost anomalies table
CREATE TABLE IF NOT EXISTS cost_anomalies (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    value DECIMAL(15,2) NOT NULL,
    expected_value DECIMAL(15,2) NOT NULL,
    deviation DECIMAL(15,2) NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    time_window_start TIMESTAMPTZ,
    time_window_end TIMESTAMPTZ,
    description TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_cost_anomalies_tenant_detected ON cost_anomalies(tenant_id, detected_at DESC);

-- Optimization recommendations table
CREATE TABLE IF NOT EXISTS optimization_recommendations (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'identified',
    resource_ids JSONB DEFAULT '[]',
    description TEXT NOT NULL,
    estimated_savings DECIMAL(15,2) NOT NULL DEFAULT 0,
    effort INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optimization_tenant_status ON optimization_recommendations(tenant_id, status);
