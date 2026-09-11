-- Migration 403: backup v2 schema
--
-- Two jobs:
--   1. Create the tables the Go backup repository actually talks to. These were
--      missing from the migrations entirely, so a fresh deployment would have
--      the table create fine but every backup call fail at runtime.
--   2. Create the WAL/binlog archive window table and the pitr-mode index.
--
-- All DDL is idempotent so partial-apply re-runs are safe.
--
-- NOTE: the previous version of this file ran
--   ALTER TABLE backup_recovery ADD COLUMN IF NOT EXISTS pitr_mode ...
-- against a table that is not created by any migration in this directory (it
-- also does not exist in the TypeScript service or the Go repository), so it
-- failed with 'relation "backup_recovery" does not exist' and aborted the run.
-- Those PITR columns belong to recovery_records, whose schema the Go model
-- declares under a "PITR fields (added by migration 055)" comment -- no such
-- migration existed either. They are created inline below instead.

-- ============================================================
-- backup_plans: configured backup plans
-- Columns match internal/infrastructure/backup/models.BackupPlan and the SQL in
-- repository.BackupRepository (Create/Get/List/Update/DeletePlan).
-- ============================================================
CREATE TABLE IF NOT EXISTS backup_plans (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      VARCHAR(64)  NOT NULL,
    name           VARCHAR(255) NOT NULL,
    type           VARCHAR(32)  NOT NULL DEFAULT 'full',
    schedule       VARCHAR(128),
    retention_days INTEGER      NOT NULL DEFAULT 30,
    target         JSONB        NOT NULL DEFAULT '{}',
    storage_config JSONB        NOT NULL DEFAULT '{}',
    encryption_key TEXT,
    enabled        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_plans_tenant
    ON backup_plans (tenant_id);
CREATE INDEX IF NOT EXISTS idx_backup_plans_enabled
    ON backup_plans (tenant_id, enabled);

-- Index the plan target's dialect for fast executor lookup. target is JSONB, so
-- this is an expression index on the extracted value. The original file indexed
-- a table named backup_plan (singular) which does not exist here.
CREATE INDEX IF NOT EXISTS idx_backup_plans_target_dialect
    ON backup_plans ((target ->> 'dialect'));

-- ============================================================
-- backup_records: individual backup executions
-- ============================================================
CREATE TABLE IF NOT EXISTS backup_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         VARCHAR(64)  NOT NULL,
    plan_id           VARCHAR(36)  NOT NULL,
    status            VARCHAR(16)  NOT NULL DEFAULT 'pending',
    size_bytes        BIGINT       NOT NULL DEFAULT 0,
    storage_path      TEXT,
    checksum          TEXT,
    compression_ratio DOUBLE PRECISION,
    error_message     TEXT,
    started_at        TIMESTAMPTZ  NOT NULL,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_records_tenant
    ON backup_records (tenant_id);
CREATE INDEX IF NOT EXISTS idx_backup_records_plan
    ON backup_records (tenant_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_backup_records_status
    ON backup_records (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_backup_records_started
    ON backup_records (tenant_id, started_at DESC);

-- ============================================================
-- recovery_records: restore / PITR runs
-- ============================================================
CREATE TABLE IF NOT EXISTS recovery_records (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          VARCHAR(64)  NOT NULL,
    plan_id            VARCHAR(36)  NOT NULL,
    plan_name          VARCHAR(255),
    backup_id          VARCHAR(36),
    status             VARCHAR(24)  NOT NULL DEFAULT 'pending',
    target_time        TIMESTAMPTZ,
    rto_target_ms      BIGINT       NOT NULL DEFAULT 0,
    rpo_target_ms      BIGINT       NOT NULL DEFAULT 0,
    actual_rto_ms      BIGINT,
    actual_rpo_ms      BIGINT,
    rto_met            BOOLEAN,
    rpo_met            BOOLEAN,
    step_executions    JSONB        NOT NULL DEFAULT '[]',
    error_message      TEXT,
    -- PITR fields. Declared inline here rather than by an ALTER against a
    -- separate table, since this is the only place recovery_records is created.
    pitr_mode          VARCHAR(16),
    wal_archive_path   VARCHAR(512),
    binlog_archive_path VARCHAR(512),
    archive_start      TIMESTAMP,
    archive_end        TIMESTAMP,
    initiated_at       TIMESTAMPTZ  NOT NULL,
    completed_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_records_tenant
    ON recovery_records (tenant_id);
CREATE INDEX IF NOT EXISTS idx_recovery_records_plan
    ON recovery_records (tenant_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_recovery_records_pitr
    ON recovery_records (tenant_id, pitr_mode);

-- ============================================================
-- verification_results: restore-drill verification outcomes
-- ============================================================
CREATE TABLE IF NOT EXISTS verification_results (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        VARCHAR(64)  NOT NULL,
    backup_id        VARCHAR(36)  NOT NULL,
    status           VARCHAR(16)  NOT NULL DEFAULT 'pending',
    integrity_check  BOOLEAN      NOT NULL DEFAULT FALSE,
    integrity_details TEXT,
    restore_test     BOOLEAN      NOT NULL DEFAULT FALSE,
    restore_details  TEXT,
    error_message    TEXT,
    verified_at      TIMESTAMPTZ,
    started_at       TIMESTAMPTZ  NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_results_tenant
    ON verification_results (tenant_id);
CREATE INDEX IF NOT EXISTS idx_verification_results_backup
    ON verification_results (tenant_id, backup_id);

-- ============================================================
-- backup_archive: WAL/binlog archive windows
-- ============================================================
CREATE TABLE IF NOT EXISTS backup_archive (
    id            VARCHAR(36) PRIMARY KEY,
    tenant_id     VARCHAR(64)  NOT NULL,
    plan_id       VARCHAR(36)  NOT NULL,
    backup_id     VARCHAR(36)  NULL,
    archive_type  VARCHAR(16)  NOT NULL CHECK (archive_type IN ('wal','binlog','archivelog','redolog','log_backup','clog')),
    window_start  TIMESTAMP    NOT NULL,
    window_end    TIMESTAMP    NULL,
    size_bytes    BIGINT       NOT NULL DEFAULT 0,
    path          VARCHAR(512) NOT NULL,
    checksum      VARCHAR(128) NULL,
    status        VARCHAR(16)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','running','completed','failed')),
    error_message TEXT         NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_archive_plan
    ON backup_archive (tenant_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_backup_archive_window
    ON backup_archive (tenant_id, window_start, window_end);
