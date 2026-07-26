-- Extend notification_templates with template engine fields
-- Migrates NotificationTemplateService.ts template rendering/inheritance support

-- Template subject template (allows {{variable}} in subject line)
ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS subject_template VARCHAR(512) DEFAULT '';

-- Template body template (primary body with {{variable}} placeholders)
ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS body_template TEXT DEFAULT '';

-- Event type discriminator (pipeline.failed, ticket.assigned, etc.)
ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS event_type VARCHAR(64) DEFAULT '';

-- Channel IDs this template targets (JSONB array of channel identifiers)
ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS channel_ids JSONB NOT NULL DEFAULT '[]';

-- Index for event-type lookups (used by template selection engine)
CREATE INDEX IF NOT EXISTS idx_templates_event_type
    ON notification_templates(tenant_id, event_type);
