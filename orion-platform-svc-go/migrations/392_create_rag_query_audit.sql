-- Migration 392: Create RAG query audit table
-- Logs who asked what, with what results, for security auditing
-- Also stores content safety filter results

CREATE TABLE IF NOT EXISTS rag_query_audit (
    id              VARCHAR(36) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    user_id         VARCHAR(128) NOT NULL DEFAULT '',
    query_text      TEXT NOT NULL,
    query_hash      VARCHAR(64) NOT NULL,
    query_type      VARCHAR(16) NOT NULL DEFAULT 'simple',   -- simple/moderate/complex
    confidence      REAL NOT NULL DEFAULT 0,
    latency_ms      INT NOT NULL DEFAULT 0,
    source_count    INT NOT NULL DEFAULT 0,
    answer_length   INT NOT NULL DEFAULT 0,
    has_feedback    BOOLEAN NOT NULL DEFAULT FALSE,
    feedback_positive BOOLEAN,
    has_correction  BOOLEAN NOT NULL DEFAULT FALSE,
    correction_text TEXT,
    safety_flagged  BOOLEAN NOT NULL DEFAULT FALSE,
    safety_reason   TEXT,
    ip_address      VARCHAR(64) NOT NULL DEFAULT '',
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_audit_tenant_time ON rag_query_audit(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_audit_user ON rag_query_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_audit_safety ON rag_query_audit(safety_flagged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_audit_query_hash ON rag_query_audit(query_hash);