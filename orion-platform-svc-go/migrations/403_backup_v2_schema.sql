-- Migration 403: backup v2 schema
-- Adds PITR fields to backup_recovery, creates backup_archive, and indexes
-- the plan's target_dialect for executor lookup. All DDL is idempotent where
-- possible so partial-apply re-runs are safe.

-- ============================================================
-- backup_recovery: PITR-related columns
-- ============================================================
ALTER TABLE backup_recovery ADD COLUMN IF NOT EXISTS pitr_mode        VARCHAR(16) NULL;
ALTER TABLE backup_recovery ADD COLUMN IF NOT EXISTS wal_archive_path  VARCHAR(512) NULL;
ALTER TABLE backup_recovery ADD COLUMN IF NOT EXISTS binlog_archive_path VARCHAR(512) NULL;
ALTER TABLE backup_recovery ADD COLUMN IF NOT EXISTS archive_start   TIMESTAMP NULL;
ALTER TABLE backup_recovery ADD COLUMN IF NOT EXISTS archive_end     TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_backup_recovery_pitr
    ON backup_recovery (tenant_id, pitr_mode);

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

-- ============================================================
-- backup_plan: index target_dialect for fast executor lookup.
-- target is stored as JSONB; the index is on the extracted dialect.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_backup_plan_target_dialect
    ON backup_plan ((CAST(target AS jsonb)->>'dialect'));
