-- Tracing module tables (auto-generated)

CREATE TABLE IF NOT EXISTS trace_spans (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    trace_id VARCHAR(255) NOT NULL,
    parent_span_id VARCHAR(255) NOT NULL,
    span_id VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    operation_name VARCHAR(255) NOT NULL,
    status_code BIGINT NOT NULL,
    duration DOUBLE PRECISION NOT NULL,
    tags VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_trace_spans_tenant ON trace_spans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trace_spans_created ON trace_spans(created_at DESC);

CREATE TABLE IF NOT EXISTS trace_sampling_configs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    sample_rate DOUBLE PRECISION NOT NULL,
    max_spans_per_sec BIGINT NOT NULL,
    enabled BOOLEAN NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_trace_sampling_configs_tenant ON trace_sampling_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trace_sampling_configs_created ON trace_sampling_configs(created_at DESC);

CREATE TABLE IF NOT EXISTS otel_collector_configs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    config_type VARCHAR(255) NOT NULL,
    config_yaml VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_otel_collector_configs_tenant ON otel_collector_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_otel_collector_configs_created ON otel_collector_configs(created_at DESC);

