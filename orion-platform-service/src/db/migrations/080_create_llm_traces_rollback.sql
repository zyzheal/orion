-- Rollback Migration 080_create_llm_traces
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: llm_traces
DROP TABLE IF EXISTS llm_traces CASCADE;

-- Dropping table: llm_token_daily_stats
DROP TABLE IF EXISTS llm_token_daily_stats CASCADE;

DROP INDEX IF EXISTS idx_llm_trace;
DROP INDEX IF EXISTS idx_llm_trace;
DROP INDEX IF EXISTS idx_llm_trace;
DROP INDEX IF EXISTS idx_llm_trace;
DROP INDEX IF EXISTS idx_llm_trace;
DROP INDEX IF EXISTS idx_llm_trace;
DROP INDEX IF EXISTS idx_llm_token_;
DROP INDEX IF EXISTS idx_llm_token_;
