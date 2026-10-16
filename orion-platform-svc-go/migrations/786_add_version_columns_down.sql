-- Rollback Migration 786: Remove version columns

ALTER TABLE alert_sla DROP COLUMN IF EXISTS version;
ALTER TABLE alert_shifts DROP COLUMN IF EXISTS version;
ALTER TABLE inspection_schedules DROP COLUMN IF EXISTS version;
ALTER TABLE sprint_reviews DROP COLUMN IF EXISTS version;
ALTER TABLE sprint_retrospectives DROP COLUMN IF EXISTS version;
ALTER TABLE rdm_requirements DROP COLUMN IF EXISTS version;
