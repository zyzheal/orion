-- 642_create_semantic_search_missing_tables.sql
-- semantic-search 模块: semantic_search_results 表无 CREATE TABLE。
-- 回滚见 642_create_semantic_search_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS semantic_search_results (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source     TEXT NOT NULL DEFAULT '',
    title      TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    score      DOUBLE PRECISION NOT NULL DEFAULT 0,
    metadata   JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_semantic_search_results_source ON semantic_search_results(source);
