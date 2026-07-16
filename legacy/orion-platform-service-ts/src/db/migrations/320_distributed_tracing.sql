-- Migration 320: Distributed Tracing + OTel Collector Config
-- 分布式追踪存储 + OpenTelemetry Collector 配置管理

CREATE TABLE IF NOT EXISTS trace_spans (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    trace_id        TEXT NOT NULL,
    span_id         TEXT NOT NULL,
    parent_span_id  TEXT,
    operation_name  TEXT NOT NULL,
    service_name    TEXT NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ,
    duration_ms     INTEGER,
    status          TEXT DEFAULT 'ok',
    status_message  TEXT,
    attributes      JSONB NOT NULL DEFAULT '{}',
    events          JSONB NOT NULL DEFAULT '[]',
    links           JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trace_spans_tenant ON trace_spans(tenant_id);
CREATE INDEX idx_trace_spans_trace ON trace_spans(trace_id);
CREATE INDEX idx_trace_spans_service ON trace_spans(service_name, start_time DESC);
CREATE INDEX idx_trace_spans_operation ON trace_spans(operation_name, start_time DESC);
CREATE INDEX idx_trace_spans_time ON trace_spans(start_time DESC);

ALTER TABLE trace_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE trace_spans FORCE ROW LEVEL SECURITY;
CREATE POLICY trace_spans_tenant_isolation ON trace_spans
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- OTel Collector 配置
CREATE TABLE IF NOT EXISTS otel_collector_configs (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    config          JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_otel_configs_tenant ON otel_collector_configs(tenant_id);

ALTER TABLE otel_collector_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE otel_collector_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY otel_configs_tenant_isolation ON otel_collector_configs
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Trace 采样配置
CREATE TABLE IF NOT EXISTS trace_sampling_configs (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    strategy        TEXT NOT NULL DEFAULT 'probabilistic',
    sample_rate     NUMERIC(5,4) NOT NULL DEFAULT 1.0,
    rules           JSONB NOT NULL DEFAULT '[]',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

ALTER TABLE trace_sampling_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trace_sampling_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY trace_sampling_tenant_isolation ON trace_sampling_configs
    USING (tenant_id = current_setting('app.current_tenant_id', true));
