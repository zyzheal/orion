-- Migration: aireview persistence
-- Created: 2026-09-06
-- Purpose: Persist SQL review history (local audit + AI semantic review).

CREATE TABLE IF NOT EXISTS dba_ai_reviews (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      TEXT        NOT NULL,
    sql_text       TEXT        NOT NULL,
    db_type        TEXT        NOT NULL DEFAULT 'mysql',
    local_audit    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    ai_suggestions JSONB       NOT NULL DEFAULT '[]'::jsonb,
    verdict        TEXT        NOT NULL DEFAULT 'needs_review',
    score          INTEGER     NOT NULL DEFAULT 0,
    model_used     TEXT        NOT NULL DEFAULT '',
    duration_ms    BIGINT      NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dba_ai_reviews_tenant ON dba_ai_reviews(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dba_ai_reviews_verdict ON dba_ai_reviews(tenant_id, verdict);
