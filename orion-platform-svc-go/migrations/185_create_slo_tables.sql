-- Slo module tables (auto-generated)

CREATE TABLE IF NOT EXISTS s_l_o_definitions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    slo_type VARCHAR(255) NOT NULL,
    target DOUBLE PRECISION NOT NULL,
    measurement_window VARCHAR(255) NOT NULL,
    alert_threshold DOUBLE PRECISION NOT NULL,
    metric_query VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    description VARCHAR(255) NOT NULL,
    tags VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_s_l_o_definitions_tenant ON s_l_o_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_s_l_o_definitions_created ON s_l_o_definitions(created_at DESC);

CREATE TABLE IF NOT EXISTS s_l_i_measurements (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    slo_id VARCHAR(255) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    measured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    total BIGINT NOT NULL,
    success BIGINT NOT NULL,
    error_count BIGINT NOT NULL,
    metadata VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_s_l_i_measurements_tenant ON s_l_i_measurements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_s_l_i_measurements_created ON s_l_i_measurements(created_at DESC);

CREATE TABLE IF NOT EXISTS error_budgets (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    slo_id VARCHAR(255) NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    total_budget DOUBLE PRECISION NOT NULL,
    remaining_budget DOUBLE PRECISION NOT NULL,
    consumed_budget DOUBLE PRECISION NOT NULL,
    budget_utilization DOUBLE PRECISION NOT NULL,
    computed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_error_budgets_tenant ON error_budgets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_budgets_created ON error_budgets(created_at DESC);

