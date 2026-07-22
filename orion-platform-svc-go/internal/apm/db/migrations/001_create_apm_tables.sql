-- APM: tracing, span, and database profiler tables

CREATE TABLE IF NOT EXISTS traces (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    trace_id      VARCHAR(64) NOT NULL,
    service       VARCHAR(256) NOT NULL,
    duration_ms   INTEGER NOT NULL DEFAULT 0,
    span_count    INTEGER NOT NULL DEFAULT 0,
    status        SMALLINT NOT NULL DEFAULT 0, -- 0=ok, 1=error
    started_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spans (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    trace_id       VARCHAR(64) NOT NULL,
    span_id        VARCHAR(64) NOT NULL,
    parent_span_id VARCHAR(64),
    service        VARCHAR(256) NOT NULL,
    operation      VARCHAR(256) NOT NULL,
    duration_ms    INTEGER NOT NULL DEFAULT 0,
    status         SMALLINT NOT NULL DEFAULT 0,
    started_at     TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS database_profiler (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    query_id     VARCHAR(64) NOT NULL,
    sql          TEXT NOT NULL,
    duration_ms  INTEGER NOT NULL DEFAULT 0,
    calls        INTEGER NOT NULL DEFAULT 0,
    database     VARCHAR(256) NOT NULL,
    last_run_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for tracing tables
CREATE INDEX IF NOT EXISTS idx_traces_tenant_trace_id ON traces (tenant_id, trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_tenant_duration ON traces (tenant_id, duration_ms DESC);
CREATE INDEX IF NOT EXISTS idx_traces_tenant_service ON traces (tenant_id, service);
CREATE INDEX IF NOT EXISTS idx_traces_tenant_started ON traces (tenant_id, started_at DESC);

-- Indexes for span tables
CREATE INDEX IF NOT EXISTS idx_spans_tenant_trace_id ON spans (tenant_id, trace_id);
CREATE INDEX IF NOT EXISTS idx_spans_tenant_service ON spans (tenant_id, service);
CREATE INDEX IF NOT EXISTS idx_spans_tenant_operation ON spans (tenant_id, operation);

-- Indexes for database profiler tables
CREATE INDEX IF NOT EXISTS idx_profiler_tenant_query_id ON database_profiler (tenant_id, query_id);
CREATE INDEX IF NOT EXISTS idx_profiler_tenant_duration ON database_profiler (tenant_id, duration_ms DESC);
CREATE INDEX IF NOT EXISTS idx_profiler_tenant_database ON database_profiler (tenant_id, database);
