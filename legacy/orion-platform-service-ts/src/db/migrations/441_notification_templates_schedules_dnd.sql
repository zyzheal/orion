-- ============================================================
-- Migration 441: Notification Templates, Schedules & DND Settings
-- ============================================================
-- Purpose:
--   Create notification_templates (with type/subject/body/variables
--   and is_system flag), notification_schedules for deferred
--   delivery, and do_not_disturb_settings for user quiet hours.
--   All tables enforce multi-tenant isolation via RLS.
-- ============================================================

-- -------------------- notification_templates --------------------
-- Note: table may already exist from migration 411;
-- IF NOT EXISTS makes this idempotent.
CREATE TABLE IF NOT EXISTS notification_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  subject       VARCHAR(500),
  body          TEXT NOT NULL,
  variables     JSONB DEFAULT '{}'::jsonb,
  is_system     BOOLEAN NOT NULL DEFAULT false,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_templates_tenant_name_type
  ON notification_templates (tenant_id, name, type);

CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant
  ON notification_templates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type
  ON notification_templates (type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_is_system
  ON notification_templates (is_system) WHERE is_system = true;

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_notification_templates ON notification_templates;
CREATE POLICY tenant_isolation_notification_templates ON notification_templates
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );


-- -------------------- notification_schedules --------------------
CREATE TABLE IF NOT EXISTS notification_schedules (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  notification_template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  scheduled_at             TIMESTAMPTZ NOT NULL,
  recipients               JSONB DEFAULT '[]'::jsonb,
  payload                  JSONB DEFAULT '{}'::jsonb,
  status                   VARCHAR(50) NOT NULL DEFAULT 'pending',
  sent_at                  TIMESTAMPTZ,
  error                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_schedules_tenant_status
  ON notification_schedules (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_schedules_scheduled_at
  ON notification_schedules (scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_schedules_tenant
  ON notification_schedules (tenant_id);

ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_schedules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_notification_schedules ON notification_schedules;
CREATE POLICY tenant_isolation_notification_schedules ON notification_schedules
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );


-- -------------------- do_not_disturb_settings --------------------
CREATE TABLE IF NOT EXISTS do_not_disturb_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  timezone   VARCHAR(100) NOT NULL DEFAULT 'UTC',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dnd_settings_user_tenant
  ON do_not_disturb_settings (user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_dnd_settings_user
  ON do_not_disturb_settings (user_id);
CREATE INDEX IF NOT EXISTS idx_dnd_settings_tenant
  ON do_not_disturb_settings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dnd_settings_active
  ON do_not_disturb_settings (tenant_id, is_active) WHERE is_active = true;

ALTER TABLE do_not_disturb_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE do_not_disturb_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_do_not_disturb_settings ON do_not_disturb_settings;
CREATE POLICY tenant_isolation_do_not_disturb_settings ON do_not_disturb_settings
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );


-- ============================================================
-- Rollback notes (manual, for reference):
--   DROP TABLE IF EXISTS do_not_disturb_settings;
--   DROP TABLE IF EXISTS notification_schedules;
--   DROP TABLE IF EXISTS notification_templates;
-- ============================================================
