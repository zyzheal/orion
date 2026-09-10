-- Migration 555: notification module tables for internal/notification/notification-repository
--
-- Background: the nested migrations/notification/001-009 were never executed
-- because database.LoadMigrations (orion-go-common/pkg/database/migrate.go)
-- skips directories ("if entry.IsDir() ... continue"), and cmd/server/config.go
-- passes only the flat migrations/ dir. So the real repository implementation
-- (internal/notification/notification-repository, 65 methods) had no tables.
--
-- Table renames (4): the original names are already claimed by EARLIER flat
-- migrations that use incompatible schemas, so we cannot ALTER them without
-- breaking the other consumers at runtime.
--
--   notification_channel_configs  <- 053_create_monitoring_tables.sql defines
--       notification_channels with is_enabled/severity_filter, and
--       internal/channel + internal/monitoring write that shape (channel has
--       secret/retry). Same table, different columns => INSERT/SELECT would
--       fail for whoever gets the wrong shape.
--
--   notification_template_definitions <- 055_create_notification_template_tables.sql
--       defines notification_templates (tenant_id UUID, title_template,
--       body_template, variables, enabled) consumed by internal/notification-template
--       and internal/alert-adapter-v2, both wired.
--
--   scheduled_notification_instances <- 174_create_scheduled-notification_tables.sql
--       defines scheduled_notifications, but that SQL is INVALID: it declares
--       "id UUID NOT NULL DEFAULT gen_random_uuid(), id UUID NOT NULL" (duplicate
--       column name) with a trailing comma, so it never executed. The wired
--       internal/scheduled-notification module (flat 174) needs
--       body/cron_expression/recipients/start_date/end_date/last_run_at/
--       max_retries/retry_count/enabled, none of which the real repository
--       repository uses; the real repository needs
--       template_id/type/message/channel/scheduled_at/next_run/notification_id/
--       sent_at/error_message. Unrelated schemas on one name.
--
-- do_not_disturb: flat 125 creates "do_not_disturbs" (plural, hour/weekday
-- model), so the singular name is free.
--
-- notifications has no flat migration at all, so CREATE TABLE is used (not
-- ADD COLUMN) — there is nothing to extend.
--
-- NOTE: notification_channel_configs is used by both notification-repository
-- (Create/List/Get/Update/Delete, is_enabled absent) and dashboard_repository
-- (COUNT(*) WHERE enabled=true). Renaming only changes the new module's view;
-- the dashboard overview channel count will now count notification channel
-- configs rather than monitoring channels, which is the intended semantics.

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL,
    user_id     VARCHAR(64) NOT NULL DEFAULT '',
    type        VARCHAR(64) NOT NULL DEFAULT 'system',
    title       VARCHAR(512) NOT NULL DEFAULT '',
    channel     VARCHAR(32) NOT NULL,
    recipient   VARCHAR(256) NOT NULL,
    subject     VARCHAR(512) NOT NULL DEFAULT '',
    body        TEXT NOT NULL DEFAULT '',
    status      VARCHAR(32) NOT NULL DEFAULT 'pending',
    metadata    JSONB NOT NULL DEFAULT '{}',
    read_at     TIMESTAMPTZ,
    sent_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_created
    ON notifications (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user_status
    ON notifications (tenant_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_status
    ON notifications (status);

-- ---------------------------------------------------------------------------
-- notification_channel_configs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_channel_configs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    type        VARCHAR(32) NOT NULL,
    config      JSONB NOT NULL DEFAULT '{}',
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_channel_configs_tenant
    ON notification_channel_configs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_channel_configs_enabled
    ON notification_channel_configs (tenant_id, enabled);

-- ---------------------------------------------------------------------------
-- notification_settings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_settings (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               VARCHAR(64) NOT NULL,
    tenant_id             VARCHAR(64) NOT NULL,
    email_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    slack_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    webhook_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
    webhook_url           VARCHAR(1024),
    pipeline_completed    BOOLEAN NOT NULL DEFAULT TRUE,
    pipeline_failed       BOOLEAN NOT NULL DEFAULT TRUE,
    ticket_assigned       BOOLEAN NOT NULL DEFAULT TRUE,
    ticket_escalated      BOOLEAN NOT NULL DEFAULT TRUE,
    sla_warning           BOOLEAN NOT NULL DEFAULT TRUE,
    sla_breached          BOOLEAN NOT NULL DEFAULT TRUE,
    alert_triggered       BOOLEAN NOT NULL DEFAULT TRUE,
    deployment_success    BOOLEAN NOT NULL DEFAULT TRUE,
    deployment_failed     BOOLEAN NOT NULL DEFAULT TRUE,
    system_alert          BOOLEAN NOT NULL DEFAULT TRUE,
    comment_mention       BOOLEAN NOT NULL DEFAULT TRUE,
    transfer_request      BOOLEAN NOT NULL DEFAULT TRUE,
    digest_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
    digest_frequency      VARCHAR(32) NOT NULL DEFAULT 'daily',
    quiet_hours_start     VARCHAR(8),
    quiet_hours_end       VARCHAR(8),
    daily_limit           INTEGER,
    rate_limit            INTEGER,
    enabled               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_settings_tenant_user
    ON notification_settings (tenant_id, user_id);

-- ---------------------------------------------------------------------------
-- notification_subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL,
    user_id     VARCHAR(64) NOT NULL,
    channel     VARCHAR(64) NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_tenant_user
    ON notification_subscriptions (tenant_id, user_id);

-- ---------------------------------------------------------------------------
-- notification_deliveries
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    notification_id UUID NOT NULL,
    recipient       VARCHAR(256) NOT NULL,
    subject         VARCHAR(512) NOT NULL DEFAULT '',
    body            TEXT NOT NULL DEFAULT '',
    channel         VARCHAR(32) NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    response_status INTEGER,
    response_body   TEXT,
    attempt_number  INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 3,
    next_retry_at   TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    fallback_channel VARCHAR(32),
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_tenant
    ON notification_deliveries (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification
    ON notification_deliveries (notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_retry
    ON notification_deliveries (status, next_retry_at);

-- ---------------------------------------------------------------------------
-- notification_template_definitions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_template_definitions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    channel     VARCHAR(32) NOT NULL,
    subject     VARCHAR(512) NOT NULL DEFAULT '',
    body        TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_template_definitions_tenant
    ON notification_template_definitions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_template_definitions_channel
    ON notification_template_definitions (tenant_id, channel);

-- ---------------------------------------------------------------------------
-- notification_policies / notification_workflows
-- (flat 150 uses "policies" / "policy_workflows", a different module, so these
--  singular names are free)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    conditions      JSONB NOT NULL DEFAULT '[]',
    channels        JSONB NOT NULL DEFAULT '[]',
    recipients      JSONB NOT NULL DEFAULT '[]',
    throttle_minutes INTEGER NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_policies_tenant
    ON notification_policies (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_policies_enabled
    ON notification_policies (tenant_id, enabled);

CREATE TABLE IF NOT EXISTS notification_workflows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    policy_id       UUID,
    steps           JSONB NOT NULL DEFAULT '[]',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_workflows_tenant
    ON notification_workflows (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_workflows_policy
    ON notification_workflows (policy_id);

-- ---------------------------------------------------------------------------
-- scheduled_notification_instances
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scheduled_notification_instances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    user_id         VARCHAR(64) NOT NULL DEFAULT '',
    template_id     UUID,
    type            VARCHAR(64) NOT NULL DEFAULT '',
    title           VARCHAR(512) NOT NULL DEFAULT '',
    message         TEXT NOT NULL DEFAULT '',
    channel         VARCHAR(32) NOT NULL DEFAULT '',
    scheduled_at    TIMESTAMPTZ,
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    next_run        TIMESTAMPTZ,
    notification_id UUID,
    sent_at         TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notification_instances_tenant
    ON scheduled_notification_instances (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_notification_instances_status
    ON scheduled_notification_instances (status);
CREATE INDEX IF NOT EXISTS idx_scheduled_notification_instances_next_run
    ON scheduled_notification_instances (status, scheduled_at);

-- ---------------------------------------------------------------------------
-- do_not_disturb
-- (flat 125 creates the plural "do_not_disturbs" for a different hour/weekday
--  model, so the singular name is free)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS do_not_disturb (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL,
    user_id     VARCHAR(64) NOT NULL,
    start_time  TIMESTAMPTZ NOT NULL,
    end_time    TIMESTAMPTZ NOT NULL,
    reason      TEXT,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_do_not_disturb_tenant
    ON do_not_disturb (tenant_id);
CREATE INDEX IF NOT EXISTS idx_do_not_disturb_active
    ON do_not_disturb (tenant_id, start_time, end_time);

-- ---------------------------------------------------------------------------
-- dashboards / dashboard_widgets / anomalies
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dashboards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboards_tenant
    ON dashboards (tenant_id);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(256) NOT NULL,
    type        VARCHAR(64) NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    size        VARCHAR(32) NOT NULL DEFAULT 'medium',
    config      JSONB NOT NULL DEFAULT '{}',
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard
    ON dashboard_widgets (dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_tenant
    ON dashboard_widgets (tenant_id);

CREATE TABLE IF NOT EXISTS anomalies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   VARCHAR(64) NOT NULL,
    type        VARCHAR(64) NOT NULL,
    severity    VARCHAR(32) NOT NULL,
    message     TEXT NOT NULL,
    details     JSONB NOT NULL DEFAULT '{}',
    source_id   VARCHAR(128),
    source_id_type VARCHAR(64),
    status      VARCHAR(32) NOT NULL DEFAULT 'open',
    resolved_at TIMESTAMPTZ,
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_tenant
    ON anomalies (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_tenant_status
    ON anomalies (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_anomalies_tenant_severity
    ON anomalies (tenant_id, severity);
