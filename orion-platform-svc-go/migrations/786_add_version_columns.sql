-- Migration 786: Add version column for optimistic locking
-- P2-4: Optimistic locking requires version INTEGER on Wave 2 tables

ALTER TABLE alert_sla ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE alert_shifts ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE inspection_schedules ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sprint_reviews ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sprint_retrospectives ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rdm_requirements ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
