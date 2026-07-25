-- sla-engine: ITSM-grade SLA calculation tables
-- Migration 001 — creates sla_profiles, sla_trackers, sla_holidays

CREATE TABLE IF NOT EXISTS sla_profiles (
    id                 VARCHAR(64) PRIMARY KEY,
    tenant_id          VARCHAR(64)  NOT NULL,
    name               VARCHAR(255) NOT NULL,
    type               VARCHAR(32)  NOT NULL DEFAULT 'both',       -- "response", "resolution", "both"
    priority           VARCHAR(8)   NOT NULL DEFAULT 'P2',         -- "P1", "P2", "P3", "P4"
    response_sla       VARCHAR(32)  NOT NULL DEFAULT '4h',         -- e.g. "1h", "4h", "8h"
    resolution_sla     VARCHAR(32)  NOT NULL DEFAULT '24h',        -- e.g. "4h", "24h", "72h"
    business_hours     BOOLEAN      NOT NULL DEFAULT FALSE,
    weekends_included  BOOLEAN      NOT NULL DEFAULT FALSE,
    holidays_excluded  BOOLEAN      NOT NULL DEFAULT FALSE,
    working_days       VARCHAR(32)  DEFAULT 'Mon-Fri',
    working_hours      VARCHAR(32)  DEFAULT '09:00-18:00',
    description        TEXT         DEFAULT '',
    status             VARCHAR(16)  NOT NULL DEFAULT 'active',     -- "active", "disabled"
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_profiles_tenant ON sla_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_profiles_status ON sla_profiles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sla_profiles_priority ON sla_profiles(priority);

CREATE TABLE IF NOT EXISTS sla_trackers (
    id                   VARCHAR(64) PRIMARY KEY,
    tenant_id            VARCHAR(64)  NOT NULL,
    sla_profile_id       VARCHAR(64)  NOT NULL REFERENCES sla_profiles(id),
    target_id            VARCHAR(64)  NOT NULL,           -- ticket/incident/change ID
    target_type          VARCHAR(32)  NOT NULL,           -- "ticket", "incident", "change"
    opened_at            TIMESTAMPTZ  NOT NULL,
    response_deadline    TIMESTAMPTZ  NOT NULL,
    resolution_deadline  TIMESTAMPTZ  NOT NULL,
    response_time        BIGINT,                           -- milliseconds (nullable until responded)
    resolution_time      BIGINT,                           -- milliseconds (nullable until resolved)
    paused_at            TIMESTAMPTZ,
    paused_reason        TEXT         DEFAULT '',
    resumed_at           TIMESTAMPTZ,
    status               VARCHAR(16)  NOT NULL DEFAULT 'active', -- "active", "responded", "resolved", "breached", "paused"
    breach_reason        TEXT         DEFAULT '',
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_trackers_tenant ON sla_trackers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_trackers_profile ON sla_trackers(sla_profile_id);
CREATE INDEX IF NOT EXISTS idx_sla_trackers_target ON sla_trackers(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_sla_trackers_status ON sla_trackers(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sla_trackers_response_deadline ON sla_trackers(response_deadline);
CREATE INDEX IF NOT EXISTS idx_sla_trackers_resolution_deadline ON sla_trackers(resolution_deadline);

CREATE TABLE IF NOT EXISTS sla_holidays (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL,
    name        VARCHAR(255) NOT NULL,
    date        DATE         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_holidays_tenant ON sla_holidays(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_holidays_date ON sla_holidays(date);
