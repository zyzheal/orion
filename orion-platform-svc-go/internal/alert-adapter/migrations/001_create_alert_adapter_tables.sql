-- Alert Adapter SPI: adapter registry and event audit tables.
--
-- Migration number: 001 (local to alert-adapter).
--
-- Tables:
--   alert_adapters  — registered pluggable alert adapter instances (tenant-scoped)
--   alert_events    — audit trail of every alert received from or sent via an adapter
--
-- Rollback: 001_create_alert_adapter_tables_down.sql

-- ===================================================================
-- alert_adapters — registered adapter instances
-- ===================================================================

CREATE TABLE IF NOT EXISTS alert_adapters (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(64)  NOT NULL,  -- prometheus, zabbix, grafana, kafka, webhook, email, sms, wechat, slack, pagerduty
    category    VARCHAR(32)  NOT NULL,  -- source, notification, export
    config      TEXT         NOT NULL DEFAULT '{}',  -- JSON adapter configuration
    status      VARCHAR(32)  NOT NULL DEFAULT 'enabled',  -- enabled, disabled, error
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    error       TEXT         NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_adapters_tenant_id ON alert_adapters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_adapters_tenant_name ON alert_adapters(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_alert_adapters_type ON alert_adapters(type);
CREATE INDEX IF NOT EXISTS idx_alert_adapters_category ON alert_adapters(category);
CREATE INDEX IF NOT EXISTS idx_alert_adapters_enabled ON alert_adapters(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_adapters_status ON alert_adapters(status);

-- ===================================================================
-- alert_events — alert event audit trail
-- ===================================================================

CREATE TABLE IF NOT EXISTS alert_events (
    id            VARCHAR(64)  PRIMARY KEY,
    tenant_id     VARCHAR(64)  NOT NULL,
    adapter_id    VARCHAR(64)  NOT NULL REFERENCES alert_adapters(id) ON DELETE CASCADE,
    source        VARCHAR(255) NOT NULL,
    title         VARCHAR(512) NOT NULL,
    message       TEXT,
    severity      VARCHAR(32)  NOT NULL DEFAULT 'info',  -- info, warning, critical, emergency
    labels        TEXT         NOT NULL DEFAULT '{}',    -- JSON label pairs
    payload       TEXT         NOT NULL DEFAULT '{}',    -- JSON alert payload
    status        VARCHAR(32)  NOT NULL DEFAULT 'received',  -- received, processed, failed
    processed_at  TIMESTAMPTZ,
    error         TEXT         NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_tenant_id ON alert_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_adapter_id ON alert_events(adapter_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_severity ON alert_events(severity);
CREATE INDEX IF NOT EXISTS idx_alert_events_status ON alert_events(status);
CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON alert_events(created_at DESC);
