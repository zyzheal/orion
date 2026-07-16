-- Migration 328: Version Archives (版本归档)
-- 版本归档与跨域事务

CREATE TABLE IF NOT EXISTS version_archives (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     TEXT NOT NULL,
    version         INTEGER NOT NULL,
    snapshot        JSONB NOT NULL DEFAULT '{}',
    archived_by     TEXT,
    archived_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason          TEXT
);

CREATE INDEX idx_version_archives_tenant ON version_archives(tenant_id);
CREATE INDEX idx_version_archives_resource ON version_archives(resource_type, resource_id, version DESC);

ALTER TABLE version_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_archives FORCE ROW LEVEL SECURITY;
CREATE POLICY version_archives_tenant_isolation ON version_archives
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS cross_domain_transactions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    source_domain   TEXT NOT NULL,
    target_domain   TEXT NOT NULL,
    operation       TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'pending',
    result          JSONB,
    error_message   TEXT,
    retry_count     INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_cross_domain_txn_tenant ON cross_domain_transactions(tenant_id);
CREATE INDEX idx_cross_domain_txn_status ON cross_domain_transactions(status);

ALTER TABLE cross_domain_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_domain_transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY cross_domain_txn_tenant_isolation ON cross_domain_transactions
    USING (tenant_id = current_setting('app.current_tenant_id', true));
