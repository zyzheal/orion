-- 619_create_artifact_ops_missing_tables.sql
-- artifact-ops 模块: artifact_scan_reports / artifact_retention_policies 2 张表无 CREATE TABLE。
-- 回滚见 619_create_artifact_ops_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS artifact_scan_reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    scan_id     TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'completed',
    findings    JSONB DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_artifact_scan_reports_tenant ON artifact_scan_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifact_scan_reports_artifact ON artifact_scan_reports(artifact_id);

CREATE TABLE IF NOT EXISTS artifact_retention_policies (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    rule       TEXT NOT NULL DEFAULT '',
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_artifact_retention_policies_tenant ON artifact_retention_policies(tenant_id);
