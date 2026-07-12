-- Finops-v2 module tables

CREATE TABLE IF NOT EXISTS cost_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    cost DOUBLE PRECISION DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    category VARCHAR(100),
    provider VARCHAR(50),
    period_start VARCHAR(50) NOT NULL,
    period_end VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cost_entries_tenant_id ON cost_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_entries_entity_id ON cost_entries(entity_id);
CREATE INDEX IF NOT EXISTS idx_cost_entries_period_start ON cost_entries(period_start);

CREATE TABLE IF NOT EXISTS chargeback_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    allocated_cost DOUBLE PRECISION DEFAULT 0,
    percentage DOUBLE PRECISION DEFAULT 0,
    period VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chargeback_entries_tenant_id ON chargeback_entries(tenant_id);

CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    period VARCHAR(50),
    currency VARCHAR(10) DEFAULT 'USD',
    category VARCHAR(100),
    alert_threshold DOUBLE PRECISION DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_budgets_tenant_id ON budgets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);

CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    estimated_savings DOUBLE PRECISION DEFAULT 0,
    confidence DOUBLE PRECISION DEFAULT 0,
    entity_id VARCHAR(255),
    entity_type VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recommendations_tenant_id ON recommendations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);

CREATE TABLE IF NOT EXISTS finops_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    period VARCHAR(50),
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS roi_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    period VARCHAR(50) NOT NULL,
    total_spend DOUBLE PRECISION DEFAULT 0,
    total_savings DOUBLE PRECISION DEFAULT 0,
    roi DOUBLE PRECISION DEFAULT 0,
    implemented_actions BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_schedules (
    provider VARCHAR(50) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (provider)
);
