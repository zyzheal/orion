-- Config-mgmt-enhanced module tables.
--
-- Migration 115 exists but creates all four tables under the wrong names:
--   115: config_mgmts, change_requests, change_histories, drift_reports
--   repo: config_mgmt, config_change_requests, config_change_history, config_drift_reports
-- `grep -rn config_change_requests migrations/` returns nothing, and the only
-- migrations that mention config_mgmts (239, 570, 572) all operate on the
-- plural table. So every one of the module's 13 registered endpoints failed
-- with `pq: relation "config_mgmt" does not exist` before any logic could run.
--
-- 115's column shapes were wrong too: `approvals VARCHAR(255) NOT NULL` cannot
-- hold the JSON array the repository writes, `expected_config`/`actual_config`
-- are 255-character VARCHARs for free-form config blobs, and it invents
-- `*_list`/`*_data` columns the repository never reads.
--
-- A second, independent runtime break: repository.Create used sqlx named
-- placeholders (:tenantId, :createdAt) while sqlx's NameMapper is strings.ToLower,
-- so `TenantID` is looked up as `tenantid` and every INSERT in the module failed
-- with `could not find name tenantId`. These INSERTs are positional for the same
-- reason.
--
-- config_drift_reports.updated_at exists because UpdateDriftReport always adds
-- it to the SET clause, but DriftReport has no UpdatedAt field, so the SELECT
-- column list in the repository deliberately omits it.
--
-- expected_config, actual_config, drift_items and remediation_log are NOT NULL
-- because DriftReport declares them as plain strings: scanning a SQL NULL into
-- a Go string fails the whole read. They default to empty/[] so a row inserted
-- without them still deserialises.

CREATE TABLE IF NOT EXISTS config_mgmt (
    id          VARCHAR(36)  PRIMARY KEY,
    tenant_id   VARCHAR(128) NOT NULL,
    name        VARCHAR(512) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_mgmt_tenant ON config_mgmt(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_mgmt_created ON config_mgmt(created_at DESC);

CREATE TABLE IF NOT EXISTS config_change_requests (
    id                 VARCHAR(36)  PRIMARY KEY,
    tenant_id          VARCHAR(128) NOT NULL,
    config_key         VARCHAR(512) NOT NULL,
    config_group       VARCHAR(256) NOT NULL,
    environment        VARCHAR(128) NOT NULL,
    change_type        VARCHAR(64)  NOT NULL,
    old_value          TEXT         NOT NULL,
    new_value          TEXT         NOT NULL,
    reason             TEXT         NOT NULL,
    risk_level         VARCHAR(32)  NOT NULL,
    requester          VARCHAR(128) NOT NULL,
    status             VARCHAR(32)  NOT NULL,
    execution_plan     TEXT         NOT NULL,
    rollback_plan      TEXT         NOT NULL,
    approvals          TEXT         NOT NULL,
    required_approvals BIGINT       NOT NULL,
    executed_at        TIMESTAMP WITH TIME ZONE,
    executed_by        VARCHAR(128),
    approved_at        TIMESTAMP WITH TIME ZONE,
    approved_by        VARCHAR(128),
    rolled_back_at     TIMESTAMP WITH TIME ZONE,
    rolled_back_by     VARCHAR(128),
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_change_requests_tenant ON config_change_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_change_requests_status ON config_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_config_change_requests_config_key ON config_change_requests(config_key);
CREATE INDEX IF NOT EXISTS idx_config_change_requests_created ON config_change_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS config_change_history (
    id                VARCHAR(36)  PRIMARY KEY,
    tenant_id         VARCHAR(128) NOT NULL,
    change_request_id VARCHAR(36)  NOT NULL,
    config_key        VARCHAR(512) NOT NULL,
    config_group      VARCHAR(256) NOT NULL,
    environment       VARCHAR(128) NOT NULL,
    action            VARCHAR(64)  NOT NULL,
    actor             VARCHAR(128) NOT NULL,
    old_value         TEXT         NOT NULL,
    new_value         TEXT         NOT NULL,
    notes             TEXT         NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_change_history_tenant ON config_change_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_change_history_request ON config_change_history(change_request_id);
CREATE INDEX IF NOT EXISTS idx_config_change_history_created ON config_change_history(created_at);

CREATE TABLE IF NOT EXISTS config_drift_reports (
    id                       VARCHAR(36)  PRIMARY KEY,
    tenant_id                VARCHAR(128) NOT NULL,
    config_group             VARCHAR(256) NOT NULL,
    drift_status             VARCHAR(32)  NOT NULL,
    expected_config          TEXT         NOT NULL DEFAULT '',
    actual_config            TEXT         NOT NULL DEFAULT '',
    drift_items              TEXT         NOT NULL DEFAULT '[]',
    total_drifts             BIGINT       NOT NULL DEFAULT 0,
    critical_drifts          BIGINT       NOT NULL DEFAULT 0,
    auto_remediation_enabled BOOLEAN      NOT NULL DEFAULT FALSE,
    remediation_log          TEXT         NOT NULL DEFAULT '[]',
    detected_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    last_checked_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at               TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_drift_reports_tenant ON config_drift_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_drift_reports_status ON config_drift_reports(drift_status);
CREATE INDEX IF NOT EXISTS idx_config_drift_reports_group ON config_drift_reports(config_group);
CREATE INDEX IF NOT EXISTS idx_config_drift_reports_created ON config_drift_reports(created_at DESC);
