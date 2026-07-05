-- Migration: 184_create_apm_tables.sql
-- Purpose: Create tables for APM (Application Performance Monitoring)
-- - spans: Distributed tracing span data
-- - slow_queries: Database slow query log

-- Distributed Tracing Spans Table
CREATE TABLE IF NOT EXISTS spans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id        VARCHAR(32) NOT NULL,
    parent_span_id  VARCHAR(16),
    span_id         VARCHAR(16) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    operation       VARCHAR(200) NOT NULL,
    kind            VARCHAR(20) NOT NULL,  -- server/client/producer/consumer/internal
    service_name    VARCHAR(100) NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    duration_ms     INTEGER NOT NULL,
    status          VARCHAR(10) NOT NULL DEFAULT 'unset',  -- ok/error/unset
    attributes      JSONB NOT NULL DEFAULT '{}',
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trace queries
CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_spans_start_time ON spans(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_spans_service_name ON spans(service_name);
CREATE INDEX IF NOT EXISTS idx_spans_duration_ms ON spans(duration_ms DESC);
CREATE INDEX IF NOT EXISTS idx_spans_status ON spans(status);
CREATE INDEX IF NOT EXISTS idx_spans_tenant_id ON spans(tenant_id);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_spans_trace_service ON spans(trace_id, service_name);
CREATE INDEX IF NOT EXISTS idx_spans_service_duration ON spans(service_name, duration_ms DESC) WHERE duration_ms > 100;

-- Database Slow Query Log
CREATE TABLE IF NOT EXISTS slow_queries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash      VARCHAR(32) NOT NULL,
    normalized_query TEXT NOT NULL,
    original_query  TEXT NOT NULL,
    duration_ms     INTEGER NOT NULL,
    params_count    INTEGER NOT NULL DEFAULT 0,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for slow query analysis
CREATE INDEX IF NOT EXISTS idx_slow_queries_hash ON slow_queries(query_hash);
CREATE INDEX IF NOT EXISTS idx_slow_queries_created_at ON slow_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slow_queries_duration ON slow_queries(duration_ms DESC);
CREATE INDEX IF NOT EXISTS idx_slow_queries_tenant ON slow_queries(tenant_id, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE spans IS 'Distributed tracing span data (W3C Trace Context)';
COMMENT ON TABLE slow_queries IS 'Database slow query log (auto-populated by DatabaseProfiler)';

-- Periodic cleanup of old data (normally handled by scheduled job)
-- DELETE FROM spans WHERE start_time < NOW() - INTERVAL '7 days';
-- DELETE FROM slow_queries WHERE created_at < NOW() - INTERVAL '30 days';
