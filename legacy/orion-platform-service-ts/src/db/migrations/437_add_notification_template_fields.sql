-- ============================================================
-- Migration 437: Add notification template fields
-- ============================================================

ALTER TABLE notification_templates
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS subject_template VARCHAR(500),
  ADD COLUMN IF NOT EXISTS variables_schema JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notification_templates_category
  ON notification_templates (tenant_id, category);
