-- Rollback Migration 055b_add_event_fallback_retry
-- Auto-generated rollback script
-- Review carefully before executing in production

DROP INDEX IF EXISTS idx_event_bu;
