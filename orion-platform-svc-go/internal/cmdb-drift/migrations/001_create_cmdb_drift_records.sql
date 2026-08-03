-- Migration: create CMDB drift detection tables
-- Module: orion-platform-svc-go/internal/cmdb-drift
-- Description: Tables for CMDB CI drift detection, tracking differences between
--              expected and actual CI states.
-- Table: cmdb_drift_records

CREATE TABLE IF NOT EXISTS cmdb_drift_records (
    id              TEXT         PRIMARY KEY,
    tenant_id       TEXT         NOT NULL,
    ci_id           TEXT         NOT NULL,
    ci_name         TEXT         NOT NULL DEFAULT '',
    ci_type         TEXT         NOT NULL DEFAULT '',
    property        TEXT         NOT NULL DEFAULT '',
    environment     TEXT         NOT NULL DEFAULT '',
    expected_value  TEXT         NOT NULL DEFAULT '',
    actual_value    TEXT         NOT NULL DEFAULT '',
    drift_type      TEXT         NOT NULL DEFAULT 'ci_modified',
    severity        TEXT         NOT NULL DEFAULT 'warning',
    detected_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    resolved_by     TEXT         NOT NULL DEFAULT '',
    resolution      TEXT         NOT NULL DEFAULT '',
    remediated      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmdb_drift_tenant     ON cmdb_drift_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_drift_ci         ON cmdb_drift_records(ci_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_drift_env        ON cmdb_drift_records(environment);
CREATE INDEX IF NOT EXISTS idx_cmdb_drift_unresolved ON cmdb_drift_records(tenant_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cmdb_drift_severity   ON cmdb_drift_records(severity);
CREATE INDEX IF NOT EXISTS idx_cmdb_drift_type       ON cmdb_drift_records(drift_type);