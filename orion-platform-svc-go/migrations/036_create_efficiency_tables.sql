-- 001_create_efficiency_tables.sql
-- Efficiency metrics and optimization tables

CREATE TABLE IF NOT EXISTS efficiency_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metric_type VARCHAR(50) NOT NULL, -- cpu, memory, cost, time, throughput
    scope VARCHAR(100), -- pipeline, service, team, project
    scope_id UUID,
    baseline_value DECIMAL(12,2),
    current_value DECIMAL(12,2),
    target_value DECIMAL(12,2),
    unit VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS efficiency_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    metric_id UUID NOT NULL REFERENCES efficiency_metrics(id),
    score DECIMAL(5,2) NOT NULL,
    score_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS efficiency_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    metric_id UUID REFERENCES efficiency_metrics(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    impact_level VARCHAR(20) NOT NULL, -- low, medium, high, critical
    estimated_savings DECIMAL(12,2),
    implementation_effort VARCHAR(20), -- low, medium, high
    status VARCHAR(20) DEFAULT 'suggested', -- suggested, accepted, implemented, rejected
    accepted_by UUID,
    accepted_at TIMESTAMPTZ,
    implemented_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_efficiency_metrics_tenant ON efficiency_metrics(tenant_id);
CREATE INDEX idx_efficiency_metrics_scope ON efficiency_metrics(scope, scope_id);
CREATE INDEX idx_efficiency_scores_metric ON efficiency_scores(metric_id);
CREATE INDEX idx_efficiency_scores_date ON efficiency_scores(score_date);
CREATE INDEX idx_efficiency_recommendations_tenant ON efficiency_recommendations(tenant_id);
CREATE INDEX idx_efficiency_recommendations_metric ON efficiency_recommendations(metric_id);
