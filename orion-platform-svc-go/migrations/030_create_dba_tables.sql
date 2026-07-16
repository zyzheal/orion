-- Dba module tables

CREATE TABLE IF NOT EXISTS sql_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    database_name VARCHAR(255) NOT NULL,
    sql_text TEXT,
    comment TEXT,
    order_type VARCHAR(50),
    status VARCHAR(50) NOT NULL,
    result TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sql_orders_tenant_id ON sql_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sql_orders_status ON sql_orders(status);
CREATE INDEX IF NOT EXISTS idx_sql_orders_user_id ON sql_orders(user_id);

CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port BIGINT NOT NULL,
    database_name VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_checked TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_data_sources_tenant_id ON data_sources(tenant_id);

CREATE TABLE IF NOT EXISTS audit_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    pattern VARCHAR(255) NOT NULL,
    severity VARCHAR(50),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_rules_tenant_id ON audit_rules(tenant_id);

CREATE TABLE IF NOT EXISTS query_execution_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    data_source_id VARCHAR(255) NOT NULL,
    data_source_name VARCHAR(255),
    sql_text TEXT,
    status VARCHAR(50) NOT NULL,
    row_count BIGINT DEFAULT 0,
    latency_ms DOUBLE PRECISION DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_query_execution_records_tenant_id ON query_execution_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_query_execution_records_user_id ON query_execution_records(user_id);
CREATE INDEX IF NOT EXISTS idx_query_execution_records_data_source_id ON query_execution_records(data_source_id);
