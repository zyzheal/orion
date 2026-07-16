-- 001_create_finops_tables.sql
-- FinOps cost operations tables: budget guards, anomalies, cost items

CREATE TABLE IF NOT EXISTS finops_budget_guards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    budget_amount DECIMAL(18,2),
    threshold_pct DECIMAL(5,2),
    currency TEXT DEFAULT 'USD',
    action TEXT DEFAULT 'warn',
    scope TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_finops_budget_guards_tenant ON finops_budget_guards(tenant_id);

CREATE TABLE IF NOT EXISTS finops_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_finops_anomalies_tenant ON finops_anomalies(tenant_id);
CREATE INDEX idx_finops_anomalies_type ON finops_anomalies(type);
CREATE INDEX idx_finops_anomalies_severity ON finops_anomalies(severity);

CREATE TABLE IF NOT EXISTS finops_cost_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    service TEXT NOT NULL,
    cost DECIMAL(18,2),
    currency TEXT DEFAULT 'USD',
    period TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_finops_cost_items_tenant ON finops_cost_items(tenant_id);
CREATE INDEX idx_finops_cost_items_service ON finops_cost_items(service);
