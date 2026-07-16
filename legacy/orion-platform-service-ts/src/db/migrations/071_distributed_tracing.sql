-- Migration 071: Distributed Tracing + OTel Unified Integration
-- Phase 3 Observability: trace spans, sampling config, OTel collector configs

-- Trace Spans table (PostgreSQL storage, Phase 1 before Jaeger/Tempo)
CREATE TABLE IF NOT EXISTS trace_spans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  trace_id        VARCHAR(64) NOT NULL,
  span_id         VARCHAR(64) NOT NULL,
  parent_span_id  VARCHAR(64),
  operation_name  VARCHAR(255) NOT NULL,
  service_name    VARCHAR(255) NOT NULL,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  duration_ms     INTEGER,
  status_code     VARCHAR(16) DEFAULT 'UNSET',  -- UNSET/OK/ERROR
  status_message  TEXT,
  attributes      JSONB DEFAULT '{}',
  events          JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trace_spans_trace ON trace_spans(tenant_id, trace_id);
CREATE INDEX IF NOT EXISTS idx_trace_spans_time ON trace_spans(tenant_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_trace_spans_service ON trace_spans(tenant_id, service_name, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_trace_spans_operation ON trace_spans(tenant_id, operation_name, start_time DESC);

-- RLS for trace_spans
ALTER TABLE trace_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE trace_spans FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON trace_spans USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Trace Sampling Config table
CREATE TABLE IF NOT EXISTS trace_sampling_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  service_name    VARCHAR(255) NOT NULL,
  sample_rate     DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  max_spans_per_second INTEGER DEFAULT 1000,
  enabled         BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sampling_tenant_service ON trace_sampling_config(tenant_id, service_name);

-- RLS for trace_sampling_config
ALTER TABLE trace_sampling_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE trace_sampling_config FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON trace_sampling_config USING (tenant_id = current_setting('app.current_tenant_id', true));

-- OTel Collector Configs table
CREATE TABLE IF NOT EXISTS otel_collector_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  config_type     VARCHAR(32) NOT NULL,    -- receiver/processor/exporter/connector
  config_yaml     TEXT NOT NULL,
  enabled         BOOLEAN DEFAULT true,
  created_by      VARCHAR(64),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otel_config_tenant ON otel_collector_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_otel_config_type ON otel_collector_configs(tenant_id, config_type);

-- RLS for otel_collector_configs
ALTER TABLE otel_collector_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE otel_collector_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON otel_collector_configs USING (tenant_id = current_setting('app.current_tenant_id', true));
