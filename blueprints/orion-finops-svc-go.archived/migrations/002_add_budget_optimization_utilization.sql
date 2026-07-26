-- Budgets: per-entity budget configuration with multi-threshold alerts
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    entity_type VARCHAR(32) NOT NULL DEFAULT 'project',
    entity_id VARCHAR(128) NOT NULL,
    name VARCHAR(256) NOT NULL,
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    period VARCHAR(16) NOT NULL DEFAULT 'monthly',
    environment VARCHAR(64) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budgets_tenant ON budgets(tenant_id, status);
CREATE INDEX idx_budgets_entity ON budgets(entity_type, entity_id);

-- Budget thresholds: per-budget alert thresholds
CREATE TABLE IF NOT EXISTS budget_thresholds (
    id UUID PRIMARY KEY,
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    percentage INT NOT NULL,
    triggered BOOLEAN NOT NULL DEFAULT FALSE,
    triggered_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budget_thresholds_budget ON budget_thresholds(budget_id);

-- Budget spend records: tracks spending against budgets
CREATE TABLE IF NOT EXISTS budget_spends (
    id UUID PRIMARY KEY,
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budget_spends_budget ON budget_spends(budget_id, recorded_at);

-- Budget alert triggers: records when thresholds are crossed
CREATE TABLE IF NOT EXISTS budget_alert_triggers (
    id UUID PRIMARY KEY,
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    threshold_pct INT NOT NULL,
    actual_cents BIGINT NOT NULL,
    usage_pct DOUBLE PRECISION NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    triggered_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budget_alert_triggers_budget ON budget_alert_triggers(budget_id);

-- Cost optimization suggestions
CREATE TABLE IF NOT EXISTS cost_optimizations (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT '',
    category VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    estimated_savings_cents BIGINT NOT NULL DEFAULT 0,
    effort INT NOT NULL DEFAULT 1,
    priority VARCHAR(16) NOT NULL DEFAULT 'medium',
    status VARCHAR(32) NOT NULL DEFAULT 'identified',
    resource_ids JSONB NOT NULL DEFAULT '[]',
    entity_type VARCHAR(32) NOT NULL DEFAULT '',
    entity_id VARCHAR(128) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_optimizations_tenant ON cost_optimizations(tenant_id, status);
CREATE INDEX idx_cost_optimizations_category ON cost_optimizations(category, priority);

-- Resource utilization tracking
CREATE TABLE IF NOT EXISTS resource_utilizations (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT '',
    resource_id VARCHAR(256) NOT NULL,
    resource_type VARCHAR(128) NOT NULL,
    resource_name VARCHAR(256) NOT NULL DEFAULT '',
    cpu_utilization DOUBLE PRECISION NOT NULL DEFAULT 0,
    memory_utilization DOUBLE PRECISION NOT NULL DEFAULT 0,
    storage_utilization DOUBLE PRECISION NOT NULL DEFAULT 0,
    monthly_cost_cents BIGINT NOT NULL DEFAULT 0,
    environment VARCHAR(64) NOT NULL DEFAULT '',
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resource_utilizations_tenant ON resource_utilizations(tenant_id, recorded_at);
CREATE INDEX idx_resource_utilizations_resource ON resource_utilizations(resource_id);
