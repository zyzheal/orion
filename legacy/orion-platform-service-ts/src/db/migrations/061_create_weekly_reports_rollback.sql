-- Rollback Migration 061_create_weekly_reports
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: weekly_reports
DROP TABLE IF EXISTS weekly_reports CASCADE;

DROP INDEX IF EXISTS idx_weekly_report;
DROP INDEX IF EXISTS idx_weekly_report;
