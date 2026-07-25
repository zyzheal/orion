-- sla-engine: SLA violation tracking table
-- Migration 002 — creates sla_violations for compliance and alerting
-- Applied after 001_create_sla_tables.sql

CREATE TABLE IF NOT EXISTS sla_violations (
    id              VARCHAR(64)  PRIMARY KEY,
    tenant_id       VARCHAR(64)  NOT NULL,
    tracker_id      VARCHAR(64)  NOT NULL REFERENCES sla_trackers(id) ON DELETE CASCADE,
    severity        VARCHAR(8)   NOT NULL DEFAULT 'P2',   -- "P0", "P1", "P2", "P3"
    violation_type  VARCHAR(16)  NOT NULL,               -- "response", "resolution"
    violated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deadline        TIMESTAMPTZ  NOT NULL,               -- the SLA deadline that was missed
    actual_time     TIMESTAMPTZ  NOT NULL,               -- when the violation was recorded
    overdue_ms      BIGINT       NOT NULL DEFAULT 1,     -- milliseconds overdue
    details         TEXT         DEFAULT '',
    notified        BOOLEAN      NOT NULL DEFAULT FALSE,
    notified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_violations_tenant ON sla_violations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_violations_tracker ON sla_violations(tracker_id);
CREATE INDEX IF NOT EXISTS idx_sla_violations_severity ON sla_violations(severity);
CREATE INDEX IF NOT EXISTS idx_sla_violations_type ON sla_violations(violation_type);
CREATE INDEX IF NOT EXISTS idx_sla_violations_notified ON sla_violations(tenant_id, notified);
CREATE INDEX IF NOT EXISTS idx_sla_violations_violated_at ON sla_violations(violated_at);
