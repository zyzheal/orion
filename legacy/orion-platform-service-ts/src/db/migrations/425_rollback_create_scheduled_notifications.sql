-- ============================================================
-- Migration 425 Rollback: Drop scheduled_notifications
-- ============================================================

DROP TABLE IF EXISTS scheduled_notifications CASCADE;
