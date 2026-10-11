-- Migration 735 down: Drop alert_breaker_state table

BEGIN;

DROP INDEX IF EXISTS idx_alert_breaker_state_window;
DROP INDEX IF EXISTS idx_alert_breaker_state_lock;

DROP TABLE IF EXISTS alert_breaker_state;

COMMIT;
