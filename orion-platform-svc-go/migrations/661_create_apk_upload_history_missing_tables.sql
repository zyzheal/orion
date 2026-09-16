-- 661_create_apk_upload_history_missing_tables.sql
-- apk-upload-history 模块: apk_uploads 表无 CREATE TABLE。
-- 回滚见 661_create_apk_upload_history_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS apk_uploads (
    id           UUID PRIMARY KEY,
    tenant_id    UUID NOT NULL,
    market       TEXT NOT NULL DEFAULT '',
    package_name TEXT NOT NULL,
    version      TEXT NOT NULL,
    version_code INTEGER NOT NULL DEFAULT 0,
    file_name    TEXT NOT NULL DEFAULT '',
    file_size    BIGINT NOT NULL DEFAULT 0,
    checksum     TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'pending',
    uploaded_by  TEXT NOT NULL DEFAULT '',
    error_msg    TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_apk_uploads_tenant ON apk_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_apk_uploads_package ON apk_uploads(package_name);
